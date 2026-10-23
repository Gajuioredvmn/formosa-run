shader_type spatial;
render_mode unshaded, fog_disabled, cull_disabled, depth_test_disabled, depth_draw_never;

uniform sampler2D scene_color : hint_screen_texture, repeat_disable, filter_linear;
uniform sampler2D scene_depth : hint_depth_texture, repeat_disable, filter_nearest;
uniform vec2 css_viewport = vec2(1280.0, 720.0);
uniform float speed_mps = 0.0;
uniform bool five_taps = false;
uniform float dof_strength = 1.0;
uniform float motion_strength = 1.0;
uniform float filmic_white = 1.0;
uniform float scene_exposure = 1.0;

void vertex() {
	POSITION = vec4(VERTEX.xy, 1.0, 1.0);
}

float metres(vec2 uv, mat4 inverse_projection) {
	float depth = textureLod(scene_depth, uv, 0.0).r;
	#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
		vec3 ndc = vec3(uv, depth) * 2.0 - 1.0;
	#else
		vec3 ndc = vec3(uv * 2.0 - 1.0, depth);
	#endif
	vec4 view = inverse_projection * vec4(ndc, 1.0);
	return max(0.001, -view.z / view.w);
}

void gather(inout vec3 sum, inout float weight, vec2 uv, float depth, vec2 pixel, mat4 inverse_projection) {
	vec2 bounded = clamp(uv, pixel * 0.5, vec2(1.0) - pixel * 0.5);
	float z = metres(bounded, inverse_projection);
	float w = 1.0 - smoothstep(max(0.35, depth * 0.025), max(1.1, depth * 0.09), abs(z - depth));
	sum += textureLod(scene_color, bounded, 0.0).rgb * w;
	weight += w;
}

vec3 preserve_compatibility_output(vec3 desired_srgb) {
	// Compatibility's screen copy is already filmic-mapped SDR. The spatial output
	// applies that curve again, even when unshaded. Invert its rational curve first;
	// the engine then restores the original output exactly once. Curve coefficients
	// follow Godot's drivers/gles3/shaders/tonemap_inc.glsl (4.7).
	float w = max(filmic_white, 0.01);
	float white_scale = ((w * (0.88 * w + 0.06) + 0.002) / (w * (0.88 * w + 0.6) + 0.06)) - 0.0333333333;
	vec3 linear_output = pow(max((desired_srgb + vec3(0.055)) / 1.055, vec3(0.0)), vec3(2.4));
	vec3 r = linear_output * white_scale + vec3(0.0333333333);
	vec3 a = 0.88 * (r - vec3(1.0));
	vec3 b = 0.6 * (r - vec3(0.1));
	vec3 c = 0.2 * (r * 0.3 - vec3(0.01));
	vec3 input_linear = max((-b - sqrt(max(b * b - 4.0 * a * c, vec3(0.0)))) / (2.0 * a), vec3(0.0)) / max(scene_exposure, 0.001);
	// Invert Compatibility's cubic sRGB decoder with two Newton refinements.
	vec3 encoded = max(1.055 * pow(input_linear, vec3(0.416666667)) - vec3(0.055), vec3(0.0));
	for (int i = 0; i < 2; i++) {
		vec3 value = encoded * (encoded * (encoded * 0.305306011 + 0.682171111) + 0.012522878);
		vec3 slope = encoded * (encoded * 0.915918033 + 1.364342222) + 0.012522878;
		encoded = max(encoded - (value - input_linear) / max(slope, vec3(0.001)), vec3(0.0));
	}
	return encoded;
}

void fragment() {
	vec2 pixel = vec2(1.0) / max(css_viewport, vec2(1.0));
	float z = metres(SCREEN_UV, INV_PROJECTION_MATRIX);
	float coc = max(1.0 - smoothstep(0.7, 2.7, z), smoothstep(180.0, 650.0, z));
	vec2 disk = pixel * (2.2 * coc * dof_strength);
	vec2 ray = SCREEN_UV - vec2(0.5, 0.54);
	float edge = smoothstep(0.36, 0.66, length(ray * vec2(1.2, 0.78)));
	float motion = 5.0 * edge * smoothstep(8.0, 70.0, abs(speed_mps)) * motion_strength;
	vec2 radial = normalize(ray / pixel + vec2(0.00001)) * pixel * motion;
	vec3 color = textureLod(scene_color, SCREEN_UV, 0.0).rgb;
	if (coc * dof_strength > 0.001 || motion > 0.001) {
		vec3 sum = color * 4.0;
		float weight = 4.0;
		if (five_taps) {
			gather(sum, weight, SCREEN_UV + disk * vec2(1.0, 0.0) + radial, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(-1.0, 0.0) - radial, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(0.0, 1.0) + radial * 0.3333, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(0.0, -1.0) - radial * 0.3333, z, pixel, INV_PROJECTION_MATRIX);
		} else {
			gather(sum, weight, SCREEN_UV + disk * vec2(1.0, 0.0) - radial, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(0.7071, 0.7071) - radial * 0.7143, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(0.0, 1.0) - radial * 0.4286, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(-0.7071, 0.7071) - radial * 0.1429, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(-1.0, 0.0) + radial * 0.1429, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(-0.7071, -0.7071) + radial * 0.4286, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(0.0, -1.0) + radial * 0.7143, z, pixel, INV_PROJECTION_MATRIX);
			gather(sum, weight, SCREEN_UV + disk * vec2(0.7071, -0.7071) + radial, z, pixel, INV_PROJECTION_MATRIX);
		}
		color = sum / weight;
	}
	#if CURRENT_RENDERER == RENDERER_COMPATIBILITY
		ALBEDO = preserve_compatibility_output(color);
	#else
		ALBEDO = color;
	#endif
	ALPHA = 1.0;
}
