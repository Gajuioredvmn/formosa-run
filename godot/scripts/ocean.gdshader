shader_type spatial;
render_mode cull_back, depth_draw_opaque;

uniform vec4 water_color : source_color = vec4(0.025, 0.39, 0.54, 1.0);
varying vec3 water_world;

void vertex() {
	water_world = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	float a = sin(water_world.x * 0.12 + water_world.z * 0.07 + TIME * 0.8);
	float b = cos(water_world.z * 0.15 - water_world.x * 0.08 + TIME * 0.6);
	float glint = pow(max(0.0, a * b), 14.0);
	NORMAL = normalize(NORMAL + vec3(a * 0.035, b * 0.025, 0.0));
	ALBEDO = mix(water_color.rgb, COLOR.rgb, 0.88) + vec3(0.014, 0.02, 0.024) * a * b;
	ROUGHNESS = 0.21 + 0.06 * a;
	METALLIC = 0.32;
	SPECULAR = 0.65;
	EMISSION = vec3(0.04, 0.065, 0.065) * glint;
}
