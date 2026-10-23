class_name FormosaVehicle
extends Node3D
## Shared web/Godot vehicle model adapter. Units: metres, seconds, radians.
## Parent gameplay owns position, road following, traffic and collision detection.
## This node loads the same GLB and animates its named visual rig.

signal model_loaded(identifier: String)
signal model_load_failed(path: String, reason: String)

@export var model_directory: String = "res://assets/models"
@export var car_id: String = "rosso"
@export_enum("player", "traffic") var category: String = "player"
@export var shadows_enabled: bool = true
@export var animate_automatically: bool = true
@export var load_on_ready: bool = false
@export var use_painted_rosso: bool = true
@export var painted_art_path: String = "res://assets/player-rosso-painted.png"

var specification: Dictionary = {}
var model: Node3D
var body: Node3D
var speed_mps: float = 0.0
var steering: float = 0.0
var brake: float = 0.0
var indicator: int = 0
var _time: float = 0.0
var _body_roll: float = 0.0
var _body_pitch: float = 0.0
var _body_yaw: float = 0.0
var _air_height: float = 0.0
var _reaction: float = 0.0
var _reaction_kind: String = ""
var _front_wheels: Array[Node3D] = []
var _wheel_spins: Array[Node3D] = []
var _wheel_radii: Array[float] = []
var _brake_materials: Array[BaseMaterial3D] = []
var _signal_materials: Array[BaseMaterial3D] = []
var _heads: Array[Node3D] = []
var _driver_arms: Array[Dictionary] = []
var _steering_wheel: Node3D
var _painted_sprite: Sprite3D
var _painted_shadow: MeshInstance3D
var _painted_proxy: MeshInstance3D
var _painted_enabled: bool = true


func _ready() -> void:
	if load_on_ready and model == null:
		load_model(car_id, category)


func configure(data: Dictionary, is_traffic: bool = false) -> Error:
	specification = data.duplicate(true)
	car_id = str(data.get("id", data.get("type", "rosso")))
	category = "traffic" if is_traffic else "player"
	return load_model(car_id, category)


func load_model(identifier: String, model_category: String = "player") -> Error:
	if identifier.is_empty() or identifier.contains("/") or identifier.contains("\\") or identifier.contains(".."):
		model_load_failed.emit(identifier, "Invalid model identifier")
		return ERR_INVALID_PARAMETER
	car_id = identifier
	category = model_category
	var prefix: String = "car-" if category == "player" else "traffic-"
	var model_path: String = model_directory.path_join(prefix + identifier + ".glb")
	var next_model: Node3D
	# Imported GLBs become PackedScenes and are included by normal Godot exports.
	if ResourceLoader.exists(model_path):
		var resource: Resource = ResourceLoader.load(model_path)
		if resource is PackedScene:
			next_model = (resource as PackedScene).instantiate() as Node3D
	# Also permit a raw GLB supplied at runtime (for local previews/content packs).
	if next_model == null and FileAccess.file_exists(model_path):
		var document := GLTFDocument.new()
		var state := GLTFState.new()
		var parse_error: Error = document.append_from_file(model_path, state)
		if parse_error == OK:
			next_model = document.generate_scene(state) as Node3D
		else:
			model_load_failed.emit(model_path, "GLB parse error %d" % parse_error)
			return parse_error
	if next_model == null:
		model_load_failed.emit(model_path, "Missing model; run node tools/export-models.mjs and import the project")
		return ERR_FILE_NOT_FOUND
	if model != null:
		remove_child(model)
		model.queue_free()
	_clear_rig()
	model = next_model
	add_child(model)
	_collect_rig(model)
	_prepare_driver_arms()
	_setup_painted_rosso()
	reset_pose()
	model_loaded.emit(identifier)
	return OK


func set_motion(velocity_mps: float, steering_input: float, brake_input: float, body_roll: float = 0.0) -> void:
	speed_mps = velocity_mps
	steering = clampf(steering_input, -1.0, 1.0)
	brake = clampf(brake_input, 0.0, 1.0)
	_body_roll = body_roll


func apply_pose(yaw: float, roll: float, pitch: float, air_height: float = 0.0) -> void:
	_body_yaw = yaw
	_body_roll = roll
	_body_pitch = pitch
	_air_height = maxf(0.0, air_height)


func set_painted_view(enabled: bool) -> void:
	## Disable for a showroom/orbit or tumble; the original GLB remains available.
	_painted_enabled = enabled


func set_indicator(direction: int) -> void:
	indicator = clampi(direction, -1, 1)


func set_crew_reaction(kind: String, strength: float = 1.0) -> void:
	_reaction_kind = kind
	_reaction = clampf(strength, 0.0, 1.0)


func _process(delta: float) -> void:
	if animate_automatically:
		update_visuals(delta)


func update_visuals(delta: float) -> void:
	if model == null:
		return
	var dt: float = clampf(delta, 0.0, 0.1)
	_time += dt
	for wheel: Node3D in _front_wheels:
		wheel.rotation.y = -steering * 0.43
	for i: int in range(_wheel_spins.size()):
		_wheel_spins[i].rotate_object_local(Vector3.RIGHT, -speed_mps * dt / _wheel_radii[i])
	for material: BaseMaterial3D in _brake_materials:
		material.emission_enabled = true
		material.emission = Color(1.0, 0.035, 0.06)
		material.emission_energy_multiplier = 0.36 + brake * 3.4
	for material: BaseMaterial3D in _signal_materials:
		material.emission_enabled = true
		material.emission = Color(1.0, 0.45, 0.035)
		material.emission_energy_multiplier = 2.3 if indicator != 0 and int(_time * 3.2) % 2 == 1 else 0.1
	if body != null:
		body.rotation = Vector3(_body_pitch, -_body_yaw, _body_roll)
	if _painted_sprite != null:
		var active: bool = _painted_enabled and _air_height < 0.08 and absf(_body_roll) < 0.25 and absf(_body_yaw) < 0.9
		_painted_sprite.visible = active
		_painted_shadow.visible = active
		_painted_proxy.visible = active and shadows_enabled
		if body != null:
			body.visible = not active
		# One authored rear view stays upright, with only subtle suspension motion.
		_painted_sprite.rotation.z = clampf(_body_roll * 0.3 - steering * 0.012, -0.035, 0.035)
	model.position.y = _air_height
	if _steering_wheel != null:
		_steering_wheel.rotation.z = -steering * 0.85
	for head: Node3D in _heads:
		var passenger_head: bool = str(head.name).begins_with("passenger")
		head.rotation.z = steering * 0.024 + sin(_time * 2.7) * 0.008 * clampf(absf(speed_mps) / 30.0, 0.0, 1.0)
		head.rotation.x = brake * 0.025 + sin(_time * 3.8) * 0.006
		head.rotation.y = sin(_time * 0.38) * 0.07 if passenger_head else -steering * 0.035
		if _reaction > 0.001:
			if _reaction_kind == "collision":
				head.rotation.x += sin(_time * 22.0) * _reaction * 0.12
			elif _reaction_kind == "drift":
				head.rotation.z += steering * _reaction * 0.08
			elif _reaction_kind == "look" and passenger_head:
				head.rotation.y -= _reaction * 0.3
	_update_driver_arms()
	_reaction = move_toward(_reaction, 0.0, dt * 1.6)


func reset_pose() -> void:
	speed_mps = 0.0
	steering = 0.0
	brake = 0.0
	indicator = 0
	_body_roll = 0.0
	_body_pitch = 0.0
	_body_yaw = 0.0
	_air_height = 0.0
	_reaction = 0.0
	_time = 0.0
	if body != null:
		body.rotation = Vector3.ZERO
	if model != null:
		model.position.y = 0.0
	for wheel: Node3D in _front_wheels:
		wheel.rotation.y = 0.0
	for wheel: Node3D in _wheel_spins:
		wheel.rotation = Vector3.ZERO
	update_visuals(0.0)


func _clear_rig() -> void:
	body = null
	_steering_wheel = null
	_front_wheels.clear()
	_wheel_spins.clear()
	_wheel_radii.clear()
	_brake_materials.clear()
	_signal_materials.clear()
	_heads.clear()
	_driver_arms.clear()
	_painted_sprite = null
	_painted_shadow = null
	_painted_proxy = null
	_painted_enabled = true


func _setup_painted_rosso() -> void:
	if not use_painted_rosso or category != "player" or car_id != "rosso" or not ResourceLoader.exists(painted_art_path):
		return
	var texture := load(painted_art_path) as Texture2D
	if texture == null:
		return
	var width: float = float(specification.get("W", 1.98))
	var length: float = float(specification.get("L", 4.5))
	_painted_sprite = Sprite3D.new()
	_painted_sprite.name = "PaintedRossoChase"
	_painted_sprite.texture = texture
	_painted_sprite.pixel_size = width / 1486.0
	_painted_sprite.centered = true
	_painted_sprite.offset = Vector2(0, 921.0 - 512.0)
	_painted_sprite.position = Vector3(0, 0.026, length * 0.44)
	_painted_sprite.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	_painted_sprite.shaded = false
	_painted_sprite.double_sided = true
	_painted_sprite.alpha_cut = SpriteBase3D.ALPHA_CUT_DISCARD
	_painted_sprite.alpha_scissor_threshold = 0.06
	_painted_sprite.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
	_painted_sprite.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	model.add_child(_painted_sprite)
	_painted_proxy = MeshInstance3D.new()
	_painted_proxy.name = "PaintedCarShadowProxy"
	var proxy_mesh := SphereMesh.new()
	proxy_mesh.radius = 1.0
	proxy_mesh.height = 2.0
	proxy_mesh.radial_segments = 20
	proxy_mesh.rings = 10
	_painted_proxy.mesh = proxy_mesh
	_painted_proxy.scale = Vector3(width * 0.44, 0.32, length * 0.39)
	_painted_proxy.position.y = 0.36
	_painted_proxy.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY
	model.add_child(_painted_proxy)
	_painted_shadow = MeshInstance3D.new()
	_painted_shadow.name = "PaintedCarContactShadow"
	var ground := PlaneMesh.new()
	ground.size = Vector2(width * 1.12, length * 0.74)
	_painted_shadow.mesh = ground
	_painted_shadow.position = Vector3(0, 0.017, 0.2)
	_painted_shadow.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var shader := Shader.new()
	shader.code = "shader_type spatial; render_mode unshaded, cull_disabled, depth_draw_never; void fragment(){vec2 p=(UV-vec2(0.5))*2.0; ALBEDO=vec3(0.006,0.012,0.018); ALPHA=(1.0-smoothstep(0.22,1.0,dot(p,p)))*0.25;}"
	var material := ShaderMaterial.new()
	material.shader = shader
	_painted_shadow.material_override = material
	model.add_child(_painted_shadow)


func _collect_rig(node: Node) -> void:
	var node_name: String = str(node.name)
	if node is Node3D:
		var transform_node := node as Node3D
		if node_name == "body":
			body = transform_node
		elif node_name == "steering_wheel":
			_steering_wheel = transform_node
		elif node_name.ends_with("_steer") and node_name.contains("wheel_front_"):
			_front_wheels.append(transform_node)
		elif node_name.ends_with("_spin") and node_name.begins_with("wheel_"):
			_wheel_spins.append(transform_node)
			_wheel_radii.append(maxf(0.1, float(_metadata(node.get_parent(), "radius", 0.34))))
		elif node_name == "driver_head" or node_name == "passenger_head":
			_heads.append(transform_node)
		elif node_name.begins_with("driver_arm_"):
			_driver_arms.append({"group": transform_node})
	if node is MeshInstance3D:
		var mesh_node := node as MeshInstance3D
		mesh_node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows_enabled else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		if mesh_node.mesh != null:
			for i: int in range(mesh_node.mesh.get_surface_count()):
				var material: Material = mesh_node.get_active_material(i)
				if not material is BaseMaterial3D:
					continue
				var brake_surface: bool = node_name.begins_with("brake_lights") or material.resource_name == "brake_lights"
				var signal_surface: bool = node_name.begins_with("signal_lights") or material.resource_name == "signal_lights"
				if brake_surface or signal_surface:
					var unique_material := material.duplicate() as BaseMaterial3D
					mesh_node.set_surface_override_material(i, unique_material)
					if brake_surface:
						_brake_materials.append(unique_material)
					else:
						_signal_materials.append(unique_material)
	for child: Node in node.get_children():
		_collect_rig(child)


func _metadata(node: Node, key: String, fallback: Variant) -> Variant:
	if node.has_meta(key):
		return node.get_meta(key)
	var extras: Variant = node.get_meta("extras", {})
	if extras is Dictionary:
		return (extras as Dictionary).get(key, fallback)
	return fallback


func _prepare_driver_arms() -> void:
	for arm: Dictionary in _driver_arms:
		var group: Node3D = arm["group"]
		var left: bool = str(group.name).ends_with("left")
		var suffix: String = "left" if left else "right"
		arm["side"] = -1.0 if left else 1.0
		arm["upper"] = group.find_child("driver_upperarm_" + suffix, true, false) as Node3D
		arm["lower"] = group.find_child("driver_forearm_" + suffix, true, false) as Node3D
		arm["hand"] = group.find_child("driver_hand_" + suffix, true, false) as Node3D
		var shoulder_data: Variant = _metadata(group, "shoulder", [arm["side"] * 0.163, -0.012, 0.002])
		arm["shoulder"] = Vector3(float(shoulder_data[0]), float(shoulder_data[1]), float(shoulder_data[2]))
		arm["wheel_z"] = float(_metadata(group, "wheelZ", -0.46))
		arm["wheel_y"] = float(_metadata(group, "wheelY", -0.15))
		arm["span"] = float(_metadata(group, "handSpan", 0.13))


func _update_driver_arms() -> void:
	var wheel_angle: float = -steering * 0.85
	for arm: Dictionary in _driver_arms:
		var side: float = arm["side"]
		var span: float = arm["span"]
		var target := Vector3(side * span * cos(wheel_angle), arm["wheel_y"] + 0.015 + side * span * sin(wheel_angle), arm["wheel_z"])
		var elbow := Vector3(side * 0.205, -0.185, target.z * 0.48)
		_position_limb(arm["upper"], arm["shoulder"], elbow)
		_position_limb(arm["lower"], elbow, target)
		var hand: Node3D = arm["hand"]
		if hand != null:
			hand.position = target


func _position_limb(limb_node: Node3D, start: Vector3, finish: Vector3) -> void:
	if limb_node == null:
		return
	var direction: Vector3 = finish - start
	if direction.length_squared() < 0.000001:
		return
	limb_node.position = (start + finish) * 0.5
	limb_node.quaternion = Quaternion(Vector3.UP, direction.normalized())
	limb_node.scale = Vector3(1.0, direction.length(), 1.0)


static func player_mass_kg(spec: Dictionary) -> float:
	return maxf(80.0, float(spec.get("massKg", 700.0 + 1200.0 * clampf(float(spec.get("mass", .6)), 0.0, 1.0))))


static func traffic_mass_kg(record: Dictionary) -> float:
	var values: Dictionary = {"sedan":1450.0,"taxi":1500.0,"pickup":1900.0,"bluetruck":1800.0,"bus":12500.0,"gravel":24000.0,"scooter":180.0,"suv":2100.0,"wagon":1750.0,"rebar":30000.0,"logs":28000.0,"train":38000.0}
	return maxf(80.0, float(record.get("massKg", values.get(str(record.get("type", "sedan")), 1450.0))))


static func solve_vehicle_impulse(a: Dictionary, b: Dictionary, normal: Vector2, restitution: float = .12, friction: float = .08) -> Dictionary:
	## Vector2 components are (road-forward s, lateral x), both in world m/s.
	## The normal points from a toward b. A stationary wall has b.static=true.
	var ma: float = maxf(80.0, float(a.get("massKg", 1450.0)))
	var mb: float = maxf(80.0, float(b.get("massKg", 1450.0)))
	var inv_a: float = 1.0 / ma
	var inv_b: float = 0.0 if bool(b.get("static", false)) else 1.0 / mb
	# Keep impulse arithmetic in 64-bit floats; Vector2 storage is 32-bit in
	# standard Godot builds and would unnecessarily round two-body momentum.
	var ns: float = float(normal.x)
	var nx: float = float(normal.y)
	var normal_length: float = sqrt(ns * ns + nx * nx)
	if normal_length < .000001:
		ns = 1.0
		nx = 0.0
	else:
		ns /= normal_length
		nx /= normal_length
	var av: float = float(a.get("v", 0.0))
	var ax: float = float(a.get("vx", 0.0))
	var bv: float = float(b.get("v", 0.0))
	var bx: float = float(b.get("vx", 0.0))
	var vn: float = maxf(0.0, (av - bv) * ns + (ax - bx) * nx)
	var vt: float = -(av - bv) * nx + (ax - bx) * ns
	var e: float = clampf(restitution, 0.0, 1.0)
	var jn: float = (1.0 + e) * vn / (inv_a + inv_b)
	# Coulomb friction cannot reverse relative slip or exceed mu times normal impulse.
	var jt: float = clampf(vt / (inv_a + inv_b), -maxf(0.0, friction) * jn, maxf(0.0, friction) * jn)
	var js: float = ns * jn - nx * jt
	var jx: float = nx * jn + ns * jt
	var after_av: float = av - js * inv_a
	var after_ax: float = ax - jx * inv_a
	var after_bv: float = bv + js * inv_b
	var after_bx: float = bx + jx * inv_b
	var energy_before: float = .5 * ma * (av * av + ax * ax) + (.5 * mb * (bv * bv + bx * bx) if inv_b > 0.0 else 0.0)
	var energy_after: float = .5 * ma * (after_av * after_av + after_ax * after_ax) + (.5 * mb * (after_bv * after_bv + after_bx * after_bx) if inv_b > 0.0 else 0.0)
	return {"a":{"v":after_av,"vx":after_ax,"massKg":ma},"b":{"v":after_bv,"vx":after_bx,"massKg":mb},
		"normal":Vector2(ns,nx),"normal_speed_mps":vn,"tangent_speed_mps":absf(vt),"normal_impulse":jn,"tangent_impulse":jt,"impulse":Vector2(js,jx),"impulse_s":js,"impulse_x":jx,
		"restitution":e,"energy_before":energy_before,"energy_after":energy_after,"dissipated_energy":maxf(0.0, energy_before - energy_after)}


static func contact_yaw_impulse(solution: Dictionary, lever: Vector2, mass_kg: float, length_m: float, width_m: float) -> float:
	var impulse: Vector2 = solution.get("impulse", Vector2.ZERO)
	var inertia: float = maxf(1.0, mass_kg * (length_m * length_m + width_m * width_m) / 12.0)
	var angular: float = (float(lever.y) * float(solution.get("impulse_s", impulse.x)) - float(lever.x) * float(solution.get("impulse_x", impulse.y))) / inertia
	# Rotation spends only part of the lost translational energy; central hits have no lever torque.
	var energy_limit: float = sqrt(2.0 * float(solution.get("dissipated_energy", 0.0)) * .15 / inertia)
	return clampf(angular, -minf(2.4, energy_limit), minf(2.4, energy_limit))


static func evaluate_contact(relative_speed_mps: float, impact_angle: float, other_to_self_mass_ratio: float = 1.0, context: Dictionary = {}) -> Dictionary:
	## Severity alone cannot turn a planar collision into upward/roll momentum.
	var closing: float = maxf(0.0, relative_speed_mps)
	var angle: float = clampf(absf(impact_angle), 0.0, PI * .5)
	var normal_speed: float = closing * cos(angle)
	var tangent_speed: float = closing * sin(angle)
	var ratio: float = maxf(.001, other_to_self_mass_ratio)
	var restitution: float = clampf(float(context.get("restitution", .12)), 0.0, 1.0)
	var impulse: float = normal_speed * (1.0 + restitution) * ratio / (1.0 + ratio)
	var response: String = "crash" if normal_speed >= 11.0 else "bump" if normal_speed >= 2.0 else "scrape"
	var mass: float = maxf(80.0, float(context.get("massKg", 1450.0)))
	var energy: float = maxf(0.0, float(context.get("dissipated_energy", .5 * mass * impulse * impulse)))
	var vertical: float = minf(maxf(0.0, float(context.get("vertical_impulse", 0.0))), sqrt(2.0 * energy * .08 / mass))
	var width: float = float(context.get("width", 1.9))
	var cg: float = maxf(.2, float(context.get("cg_height", .52)))
	var tipping_energy: float = mass * 9.81 * (sqrt(width * width * .25 + cg * cg) - cg)
	var roll_energy: float = minf(maxf(0.0, float(context.get("roll_energy", 0.0))), energy * .18)
	var trip: bool = bool(context.get("trip", false)) or float(context.get("up_normal", 0.0)) > .25
	var tumble: bool = (trip and normal_speed > 9.0 and vertical > 1.5) or roll_energy > tipping_energy
	if tumble:
		response = "tumble"
	return {"kind":response,"normal_speed_mps":normal_speed,"tangent_speed_mps":tangent_speed,"speed_loss_mps":impulse,"restitution":restitution,
		"tangent_retention":1.0 if tangent_speed < .00001 else maxf(0.0, 1.0 - minf(tangent_speed, .08 * impulse) / tangent_speed),
		"yaw_impulse":float(context.get("yaw_impulse", 0.0)),"crew_reaction":clampf(normal_speed / 24.0, 0.0, 1.0),
		"tumble":tumble,"vertical_impulse":vertical if tumble else 0.0,"roll_energy":roll_energy if tumble else 0.0}
