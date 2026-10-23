extends Node3D
## Native companion to the web game. All cars/routes/colliders come from the
## shared JSON; the original arcade physics remain independent of rigid bodies.
const VehicleScript = preload("res://godot/scripts/vehicle.gd")
const WorldScript = preload("res://godot/scripts/world.gd")
const TrafficScript = preload("res://godot/scripts/traffic.gd")

var data: Dictionary = {}
var pieces: Dictionary = {}
var cars: Array = []
var spec: Dictionary = {}
var world: Node3D
var traffic: Node
var player: Node3D
var camera: Camera3D
var lens_enabled: bool = true
var _lens_quad: MeshInstance3D
var _lens_material: ShaderMaterial
var state: String = "select"
var piece_id: String = "s1"
var s: float = 80.0
var x: float = 0.0
var v: float = 0.0
var vx: float = 0.0
var yaw: float = 0.0
var body_roll: float = 0.0
var body_pitch: float = 0.0
var rpm: float = 900.0
var gear: int = 1
var at_gearbox: bool = true
var auto_throttle: bool = true
var tilt_control: bool = false
var remaining: float = 95.0
var elapsed: float = 0.0
var countdown: float = 3.0
var selected_car: int = 0
var stage_number: int = 1
var crashes: int = 0
var passed: int = 0
var route: Array[String] = []
var checkpoints: Dictionary = {}
var quality: String = "high"
var world_k: float = 1.5
var _shift_cd: float = 0.0
var _hit_cd: float = 0.0
var _crash: float = 0.0
var _crash_spin: float = 0.0
var _crash_air_v: float = 0.0
var _crash_roll: float = 0.0
var _crash_duration: float = 1.2
var _air: float = 0.0
var _drift: bool = false
var _steer: float = 0.0
var _brake: float = 0.0
var _touch: Dictionary = {"left": false, "right": false, "gas": false, "brake": false}
var _touch_buttons: Dictionary = {}
var _touch_fingers: Dictionary = {}
var _vehicles: Array = []
var _traffic_models: Dictionary = {}
var _camera_ready: bool = false
var _notice_time: float = 0.0
var _pause_from: String = "run"
var _save: ConfigFile = ConfigFile.new()
var _hud_root: Control
var _menu: PanelContainer
var _touch_root: Control
var _location: Label
var _timer: Label
var _speed: Label
var _status: Label
var _fork: Label
var _notice: Label
var _engine_audio: AudioStreamPlayer
var _engine_waves: Dictionary = {}
var _sun: DirectionalLight3D
var _shadow_size: int = 0


func _ready() -> void:
	Engine.max_fps = 60
	_setup_input()
	_load_data()
	_setup_scene()
	_setup_ui()
	if cars.is_empty() or pieces.is_empty():
		_show_error("缺少遊戲基本資料\n請先產生 res://data/game.json，再重新啟動。")
		return
	_save.load("user://formosa-progress.cfg")
	selected_car = clampi(int(_save.get_value("settings", "car", 0)), 0, cars.size() - 1)
	quality = str(_save.get_value("settings", "quality", "high"))
	world.setup(data)
	traffic.setup(data)
	piece_id = str(data.get("root", pieces.keys()[0]))
	_show_selection()


func _load_data() -> void:
	if not FileAccess.file_exists("res://data/game.json"):
		return
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/game.json"))
	if not parsed is Dictionary:
		return
	data = parsed
	cars = data.get("cars", [])
	var source: Variant = data.get("pieces", {})
	if source is Array:
		for item: Dictionary in source:
			pieces[str(item["id"])] = item
	elif source is Dictionary:
		pieces = source
	world_k = float(data.get("rules", {}).get("world_k", 1.5))


func _setup_scene() -> void:
	world = WorldScript.new()
	add_child(world)
	traffic = TrafficScript.new()
	add_child(traffic)
	player = VehicleScript.new()
	player.animate_automatically = false
	add_child(player)
	camera = Camera3D.new()
	camera.fov = 52.0
	camera.near = 0.12
	camera.far = 1800.0
	camera.current = true
	add_child(camera)
	_setup_lens()
	var environment_node := WorldEnvironment.new()
	var environment := Environment.new()
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color(0.07, 0.37, 0.8)
	sky_material.sky_horizon_color = Color(0.66, 0.83, 0.93)
	sky_material.ground_horizon_color = Color(0.55, 0.68, 0.69)
	sky.sky_material = sky_material
	environment.background_mode = Environment.BG_SKY
	environment.sky = sky
	# Approved B: warm direct sun with a cool, restrained ambient fill.
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("9bc8ff")
	environment.ambient_light_energy = 0.48
	environment.ambient_light_sky_contribution = 0.16
	environment.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.tonemap_exposure = 1.0
	_lens_material.set_shader_parameter("filmic_white", environment.tonemap_white)
	_lens_material.set_shader_parameter("scene_exposure", environment.tonemap_exposure)
	environment_node.environment = environment
	add_child(environment_node)
	_sun = DirectionalLight3D.new()
	_sun.light_color = Color("ffdfa3")
	# Three's Lambert light is scaled by 1/PI; Godot's energy multiplier is
	# calibrated here to preserve B's highlights without altering vehicle colour.
	_sun.light_energy = 4.5 / PI
	_sun.shadow_enabled = true
	_sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	_sun.directional_shadow_max_distance = 184.0
	_sun.shadow_bias = .025
	_sun.shadow_normal_bias = .2
	add_child(_sun)
	_engine_audio = AudioStreamPlayer.new()
	_engine_audio.volume_db = -80.0
	add_child(_engine_audio)


func _setup_lens() -> void:
	_lens_quad = MeshInstance3D.new()
	_lens_quad.name = "FormosaDepthLens"
	var quad := QuadMesh.new()
	quad.size = Vector2(2.0, 2.0)
	_lens_quad.mesh = quad
	_lens_quad.position.z = -1.0
	_lens_quad.extra_cull_margin = 16384.0
	_lens_quad.ignore_occlusion_culling = true
	_lens_quad.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_lens_material = ShaderMaterial.new()
	_lens_material.shader = preload("res://godot/shaders/formosa_lens.gdshader")
	# Filter opaque/cutout sprites first. Foam and translucent contact shadows are
	# drawn afterwards, so Godot's opaque screen-copy limitation cannot erase them.
	_lens_material.render_priority = -128
	_lens_material.set_shader_parameter("five_taps", OS.has_feature("mobile"))
	_lens_quad.material_override = _lens_material
	camera.add_child(_lens_quad)


func _setup_input() -> void:
	var bindings: Dictionary = {"left": [KEY_LEFT, KEY_A], "right": [KEY_RIGHT, KEY_D], "gas": [KEY_UP, KEY_W], "brake": [KEY_DOWN, KEY_S, KEY_SPACE], "shift_up": [KEY_E, KEY_PAGEUP], "shift_down": [KEY_Q, KEY_PAGEDOWN], "pause": [KEY_ESCAPE, KEY_P], "restart": [KEY_R]}
	for action: String in bindings:
		if not InputMap.has_action(action):
			InputMap.add_action(action)
		for key: int in bindings[action]:
			var event := InputEventKey.new()
			event.physical_keycode = key
			InputMap.action_add_event(action, event)


func _input(event: InputEvent) -> void:
	if event is InputEventScreenTouch:
		_handle_touch(event.index, event.position, event.pressed)
		return
	if event is InputEventScreenDrag:
		_handle_touch(event.index, event.position, true)
		return
	if event.is_action_pressed("pause"):
		_toggle_pause()
	elif event.is_action_pressed("restart") and state != "select":
		_start_run()
	elif state == "run" and not at_gearbox:
		if event.is_action_pressed("shift_up"):
			_shift(1)
		elif event.is_action_pressed("shift_down"):
			_shift(-1)


func _physics_process(dt: float) -> void:
	if cars.is_empty() or pieces.is_empty():
		return
	_notice_time = maxf(0.0, _notice_time - dt)
	if state == "countdown":
		countdown -= dt
		_notice.text = str(ceili(countdown)) if countdown > 0.0 else "GO!"
		if countdown <= 0.0:
			state = "run"
			_notice_time = 0.8
	elif state == "run":
		remaining -= dt
		elapsed += dt
		_hit_cd = maxf(0.0, _hit_cd - dt)
		_shift_cd = maxf(0.0, _shift_cd - dt)
		_step_car(dt)
		_transition_piece()
		if state == "run":
			# Road distance advances at world_k; collision velocities use that same space.
			_vehicles = traffic.update_traffic(dt, piece_id, s, x, v * world_k, vx)
			for contact: Dictionary in traffic.collision_events:
				_apply_traffic_contact(contact)
			_static_contacts()
			_check_checkpoint()
			if remaining <= 0.0:
				_finish(false)
	_update_hud()


func _process(dt: float) -> void:
	if cars.is_empty() or pieces.is_empty():
		return
	var q: Dictionary = world.sample(piece_id, s, x)
	var center: Vector3 = q.get("position", Vector3(q.get("x", 0), q.get("y", 0), q.get("z", 0)))
	var heading: float = float(q.get("h", 0))
	var tangent := Vector3(sin(heading), 0, -cos(heading))
	var right := Vector3(cos(heading), 0, sin(heading))
	_sun.position = center - right * 88.0 - tangent * 66.0 + Vector3.UP * 94.0
	_sun.look_at(center + tangent * 38.0, Vector3.UP)
	var shadow_size: int = 1024 if OS.has_feature("mobile") or quality == "low" else 2048
	if shadow_size != _shadow_size:
		RenderingServer.directional_shadow_atlas_set_size(shadow_size, true)
		_shadow_size = shadow_size
	var road_pitch: float = _road_pitch()
	player.position = center + Vector3.UP * 0.018
	player.rotation = Vector3(road_pitch, -heading, 0)
	player.set_motion(v, _steer, _brake, body_roll)
	player.apply_pose(yaw, body_roll, body_pitch, _air)
	player.update_visuals(0.0 if state == "pause" else dt)
	world.update_view(piece_id, s, quality)
	var desired: Vector3 = center - tangent * 5.55 + Vector3.UP * 1.43
	var target: Vector3 = center + tangent * 20.0 + Vector3.UP * 1.1
	if not _camera_ready:
		camera.position = desired
		_camera_ready = true
	else:
		camera.position = camera.position.lerp(desired, 1.0 - exp(-dt * 9.0))
	camera.look_at(target, Vector3.UP)
	_lens_quad.visible = lens_enabled and quality != "low"
	if _lens_quad.visible:
		_lens_material.set_shader_parameter("speed_mps", v if state == "run" else 0.0)
		_lens_material.set_shader_parameter("css_viewport", get_viewport().get_visible_rect().size)
		_lens_material.set_shader_parameter("five_taps", OS.has_feature("mobile") or quality == "medium")
	_update_traffic_visuals(0.0 if state == "pause" else dt)
	if _engine_audio.stream != null:
		var audible: bool = state == "run" or state == "countdown"
		_engine_audio.volume_db = lerpf(_engine_audio.volume_db, -21.0 if audible else -80.0, minf(1.0, dt * 8.0))
		_engine_audio.pitch_scale = lerpf(_engine_audio.pitch_scale, clampf(rpm / 2300.0, .45, 3.4), minf(1.0, dt * 12.0))


func _step_car(dt: float) -> void:
	var q: Dictionary = world.sample(piece_id, s, x)
	var hw: float = float(q.get("hw", 6.0))
	var car_width: float = float(spec.get("W", 1.9))
	var offroad: bool = x < float(q.get("left", -hw)) + car_width * 0.3 or x > float(q.get("right", hw)) - car_width * 0.3
	if _crash > 0.0:
		_crash += dt
		# Tyre braking dissipates the post-impact signed motion, including a rebound.
		v = move_toward(v, 0.0, 9.0 * dt / world_k)
		s = maxf(0.0, s + v * dt * world_k)
		x += vx * dt
		vx = move_toward(vx, 0.0, 8.0 * dt)
		yaw += _crash_spin * dt
		_crash_spin = move_toward(_crash_spin, 0.0, dt * 2.8)
		body_roll = sin(minf(1.0, _crash / _crash_duration) * PI) * _crash_roll
		_air = maxf(0.0, _crash_air_v * _crash - 4.905 * _crash * _crash)
		if _crash > _crash_duration:
			_crash = 0.0
			_air = 0.0
			yaw = 0.0
			body_roll = 0.0
			v = maxf(0.0, v)
			vx = 0.0
			x = clampf(x, -hw + car_width * 0.6, hw - car_width * 0.6)
		return
	var steering_input: float = Input.get_axis("left", "right") + float(_touch.right) - float(_touch.left)
	if tilt_control:
		steering_input += clampf(Input.get_gravity().x / 4.5, -1.0, 1.0)
	_steer = lerpf(_steer, clampf(steering_input, -1.0, 1.0), 1.0 - exp(-dt * 7.0))
	_brake = 1.0 if Input.is_action_pressed("brake") or _touch.brake else 0.0
	var throttle: float = 1.0 if (auto_throttle or Input.is_action_pressed("gas") or _touch.gas) and _brake < 0.1 else 0.0
	var vtop: float = float(spec.get("top", 296)) / 3.6
	var gears: int = int(spec.get("gears", 6))
	var redline: float = {"v12": 8200.0, "v8": 6600.0, "i6": 7200.0, "i4": 7600.0, "flat6": 7800.0, "turbo": 8600.0}.get(str(spec.get("engine", "v12")), 7600.0)
	var gear_max: float = vtop * pow(float(gear) / gears, 0.74)
	rpm = maxf(900.0, v / gear_max * redline)
	if at_gearbox and _shift_cd <= 0.0:
		if rpm > redline * 0.94 and gear < gears and throttle > 0.1:
			_shift(1)
		elif rpm < redline * 0.38 and gear > 1:
			_shift(-1)
	var ratio: float = clampf(rpm / redline, 0.0, 1.05)
	var torque: float = clampf(0.5 + 1.25 * ratio - 0.95 * ratio * ratio, 0.35, 1.0)
	var first_max: float = vtop * pow(1.0 / gears, 0.74)
	var pull: float = pow(first_max / gear_max, 0.82)
	var a0: float = 6.2 + 5.6 * float(spec.get("acc", 0.72))
	var top_pull: float = pow(first_max / vtop, 0.82)
	var drag: float = (a0 * 0.8 * top_pull - 0.35) / (vtop * vtop)
	var acceleration: float = a0 * torque * pull * throttle * (0.15 if _shift_cd > 0.08 else 1.0) - 0.35 - drag * v * v - _brake * (13.0 + 3.0 * float(spec.get("grip", .72)))
	if offroad:
		acceleration -= 3.5 + v * .07
	if rpm > redline * 1.03:
		acceleration = minf(acceleration, -2.0)
	v = clampf(v + acceleration * dt, 0.0, vtop * 1.025)
	# Road curvature supplies the outward force; grip/mass are the original specs.
	var ahead: Dictionary = world.sample(piece_id, s + 4.0, 0)
	var behind: Dictionary = world.sample(piece_id, maxf(0, s - 4.0), 0)
	var curvature: float = (float(ahead.get("h", 0)) - float(behind.get("h", 0))) / 8.0
	var centrifugal: float = v * v * curvature
	_drift = _brake > 0.1 and absf(_steer) > 0.4 and v > 22.0
	var grip: float = (11.0 + 5.0 * float(spec.get("grip", .72))) * (0.4 if offroad else 1.0) * (1.04 if _drift else 1.0)
	var response: float = 2.6 + float(spec.get("steer", .7)) * 3.0
	var wanted_vx: float = _steer * minf(v * .19, 9.0) * (0.65 + float(spec.get("steer", .7)) * .55)
	var lateral_accel: float = clampf((wanted_vx - vx) * response, -grip, grip) - centrifugal
	vx += lateral_accel * dt / (0.72 + float(spec.get("mass", .6)) * .4)
	if absf(centrifugal) > grip:
		v = maxf(0.0, v - (absf(centrifugal) - grip) * dt * .06)
	x += vx * dt
	x = clampf(x, float(q.get("left", -hw)) - 4.0, float(q.get("right", hw)) + 4.0)
	s += v * dt * world_k
	yaw = lerpf(yaw, atan2(vx, maxf(6.0, v)) * .9 + (_steer * .38 if _drift else 0.0), minf(1, dt * 6.0))
	body_roll = lerpf(body_roll, -clampf(vx * .012 + centrifugal * .006, -.09, .09), minf(1, dt * 5.0))
	body_pitch = lerpf(body_pitch, clampf(acceleration * .004, -.06, .04), minf(1, dt * 5.0))
	if _drift:
		player.set_crew_reaction("drift", .35)


func _shift(direction: int) -> void:
	if _shift_cd > 0.0:
		return
	gear = clampi(gear + direction, 1, int(spec.get("gears", 6)))
	_shift_cd = .18


func _transition_piece() -> void:
	var piece: Dictionary = pieces[piece_id]
	var length: float = float(piece.get("length", 1))
	var children: Array = piece.get("children", [])
	var goal_s: float = float(piece.get("goalS", length)) if piece.get("goalS") != null else length
	if children.is_empty() and s >= goal_s:
		_finish(true)
		return
	if s < length:
		return
	if children.is_empty():
		_finish(true)
		return
	var offsets: Array = piece.get("forkOff", [-3.5, 3.5])
	var divider: float = float(piece.get("forkDiv", float(offsets[0]) + float(offsets[1]) if offsets.size() == 2 else 0.0))
	var branch: int = 0 if children.size() == 1 or x < divider else 1
	x -= float(offsets[branch]) if offsets.size() > branch else 0.0
	s -= length
	piece_id = str(children[branch])
	stage_number += 1
	route.append(piece_id)
	_notice_message(str(pieces[piece_id].get("name", piece_id)), 2.0)


func _check_checkpoint() -> void:
	if stage_number < 2 or checkpoints.has(piece_id):
		return
	var checkpoint: Variant = pieces[piece_id].get("checkS", 40.0)
	if checkpoint == null or s < float(checkpoint):
		return
	checkpoints[piece_id] = true
	var bonus: float = float(data.get("rules", {}).get("checkpoint_bonus", 95))
	remaining += bonus
	_notice_message("CHECKPOINT  +%d 秒" % int(bonus), 2.5)


func _apply_traffic_contact(contact: Dictionary) -> void:
	var result: Dictionary = contact.get("solution", {})
	if result.is_empty():
		return
	var apply_velocity: bool = _hit_cd <= 0.0 and _crash <= 0.0 and not bool(contact.get("separation_only", false))
	traffic.commit_contact(contact, apply_velocity)
	var normal: Vector2 = contact.get("normal", Vector2.ZERO)
	var separation: Vector2 = contact.get("separation", Vector2.ZERO)
	var other_mass: float = float(result.b.massKg)
	var ratio: float = other_mass / (other_mass + float(result.a.massKg))
	s = maxf(0.0, s - normal.x * separation.x * ratio)
	x -= normal.y * separation.y * ratio
	if not apply_velocity:
		return
	_hit_cd = float(contact.get("cooldown", .45))
	v = float(result.a.v) / world_k
	vx = float(result.a.vx)
	_apply_contact_reaction(contact.get("response", {}), float(contact.get("closing", 0.0)))


func _apply_contact_reaction(response: Dictionary, normal_speed: float) -> void:
	var yaw_impulse: float = float(response.get("yaw_impulse", 0.0))
	player.set_crew_reaction("collision", float(response.get("crew_reaction", 0.0)))
	if bool(response.get("tumble", false)) or normal_speed > 24.0 or v * world_k < -.2:
		_begin_crash(clampf(normal_speed / 50.0, 0.0, 1.0), {
			"yaw_impulse":yaw_impulse,"tumble":response.get("tumble", false),"vertical_impulse":response.get("vertical_impulse", 0.0),
			"roll_energy":response.get("roll_energy", 0.0),"count_crash":normal_speed >= 11.0})
	else:
		yaw += clampf(yaw_impulse * .09, -.18, .18)


func _static_contacts() -> void:
	if _crash > 0.0:
		return
	var half_width: float = float(spec.get("W", 1.9)) * .48
	var half_length: float = float(spec.get("L", 4.5)) * .5
	var colliders: Array = world.get_colliders(piece_id) if world.has_method("get_colliders") else pieces[piece_id].get("hdColliders", [])
	for collider: Dictionary in colliders:
		var a: float = float(collider.get("s0", collider.get("s", -1000)))
		var b: float = float(collider.get("s1", a + 2.0))
		if s + half_length < a or s - half_length > b:
			continue
		var left: float = float(collider.get("x0", -1000))
		var right: float = float(collider.get("x1", left))
		if x + half_width < left or x - half_width > right:
			continue
		var ds: float = (a + b) * .5 - s
		var dx: float = (left + right) * .5 - x
		var overlap_s: float = minf(s + half_length, b) - maxf(s - half_length, a)
		var overlap_x: float = minf(x + half_width, right) - maxf(x - half_width, left)
		var frontal: bool = overlap_s < overlap_x or (str(collider.get("kind", "solid")) != "wall" and absf(dx) < half_width * .55)
		var n: Vector2 = Vector2(signf(ds if ds != 0.0 else 1.0), 0.0) if frontal else Vector2(0.0, signf(dx if dx != 0.0 else 1.0))
		# Correct penetration even during cooldown; do not reapply a speed penalty.
		if frontal:
			s = maxf(0.0, a - half_length - .01) if n.x > 0.0 else b + half_length + .01
		else:
			x = left - half_width - .01 if n.y > 0.0 else right + half_width + .01
		if _hit_cd <= 0.0:
			var mass: float = VehicleScript.player_mass_kg(spec)
			var relative: Vector2 = Vector2(v * world_k, vx)
			var result: Dictionary = VehicleScript.solve_vehicle_impulse({"v":relative.x,"vx":vx,"massKg":mass}, {"v":0.0,"vx":0.0,"static":true}, n, .08, .08)
			var lever: Vector2 = Vector2(n.x * half_length if frontal else clampf(ds, -half_length, half_length), clampf(dx, -half_width, half_width))
			var yaw_impulse: float = VehicleScript.contact_yaw_impulse(result, lever, mass, half_length * 2.0, half_width * 2.0)
			var trip: bool = bool(collider.get("trip", false)) or str(collider.get("kind", "solid")) == "curb"
			var up: float = float(collider.get("up_normal", .35 if trip else 0.0))
			var response: Dictionary = VehicleScript.evaluate_contact(relative.length(), atan2(float(result.tangent_speed_mps), float(result.normal_speed_mps)), 1000000.0,
				{"massKg":mass,"width":half_width * 2.0,"dissipated_energy":result.dissipated_energy,"yaw_impulse":yaw_impulse,"trip":trip,"up_normal":up,
				"vertical_impulse":float(result.normal_speed_mps) * maxf(0.0, up),"roll_energy":float(result.dissipated_energy) * .08 if trip else 0.0})
			v = float(result.a.v) / world_k
			vx = float(result.a.vx)
			_hit_cd = .45
			_apply_contact_reaction(response, float(result.normal_speed_mps))
		return


func _begin_crash(strength: float, contact: Dictionary = {}) -> void:
	if _crash > 0.0:
		return
	if bool(contact.get("count_crash", true)):
		crashes += 1
	_crash = .001
	_crash_spin = clampf(float(contact.get("yaw_impulse", 0.0)), -2.4, 2.4)
	var tumble: bool = bool(contact.get("tumble", false))
	_crash_air_v = maxf(0.0, float(contact.get("vertical_impulse", 0.0))) if tumble else 0.0
	_crash_roll = 0.0
	if tumble:
		var inertia: float = VehicleScript.player_mass_kg(spec) * (pow(float(spec.get("W", 1.9)), 2.0) + 1.0) / 12.0
		_crash_roll = signf(_crash_spin) * minf(2.5, sqrt(2.0 * float(contact.get("roll_energy", 0.0)) / inertia) * .7)
	_crash_duration = maxf(.7 + strength * .8, absf(v * world_k) / 9.0 + .08 if v < 0.0 else 0.0)
	_crash_duration = maxf(_crash_duration, _crash_air_v / 4.905 + .12)
	player.set_crew_reaction("collision", strength)


func _road_pitch() -> float:
	var a: Dictionary = world.sample(piece_id, maxf(0, s - 3.0), 0)
	var b: Dictionary = world.sample(piece_id, s + 3.0, 0)
	return atan2(float(b.get("y", 0)) - float(a.get("y", 0)), 6.0)


func _update_traffic_visuals(dt: float) -> void:
	var active: Dictionary = {}
	for vehicle: Dictionary in _vehicles:
		var identifier: String = str(vehicle.get("id", ""))
		active[identifier] = true
		var visual: Node3D = _traffic_models.get(identifier)
		if visual == null:
			if bool(vehicle.get("parade", false)):
				visual = _parade_visual(str(vehicle.get("type", "marchers")))
			else:
				visual = VehicleScript.new()
				visual.shadows_enabled = false
				visual.animate_automatically = false
				add_child(visual)
				visual.configure({"id": "train" if vehicle.get("train", false) else vehicle.get("type", "sedan")}, true)
			_traffic_models[identifier] = visual
		var q: Dictionary = world.sample(str(vehicle.get("piece_id", piece_id)), float(vehicle.get("s", 0)), float(vehicle.get("x", 0)))
		visual.position = q.get("position", Vector3(q.get("x", 0), q.get("y", 0), q.get("z", 0)))
		visual.rotation.y = -float(q.get("h", 0)) + (PI if vehicle.get("oncoming", false) or float(vehicle.get("v", 0)) < 0.0 else 0.0)
		if visual.has_method("set_motion"):
			visual.set_motion(float(vehicle.get("v", 0)), 0.0, float(vehicle.get("brake", 0)))
			visual.set_indicator(int(vehicle.get("signal", 0)))
			visual.update_visuals(dt)
	for identifier: String in _traffic_models.keys():
		if not active.has(identifier):
			_traffic_models[identifier].queue_free()
			_traffic_models.erase(identifier)


func _parade_visual(kind: String) -> Node3D:
	var result := Node3D.new()
	add_child(result)
	var red := StandardMaterial3D.new()
	red.albedo_color = Color(.68, .12, .08)
	var gold := StandardMaterial3D.new()
	gold.albedo_color = Color(.9, .65, .2)
	var dark := StandardMaterial3D.new()
	dark.albedo_color = Color(.12, .15, .18)
	if kind == "palanquin":
		_simple_box(result, Vector3(1.05, .9, 1.5), Vector3(0, 1.15, 0), red)
		_simple_box(result, Vector3(1.45, .15, 1.85), Vector3(0, 1.72, 0), gold)
		_simple_box(result, Vector3(.9, .18, 1.3), Vector3(0, 1.87, 0), red)
		for side: int in [-1, 1]:
			_simple_box(result, Vector3(.08, .08, 3.8), Vector3(side * .55, .75, 0), dark)
		var blessing := Label3D.new()
		blessing.text = "平安"
		blessing.font_size = 48
		blessing.pixel_size = .005
		blessing.position = Vector3(0, 1.35, .76)
		result.add_child(blessing)
	else:
		for i: int in range(3):
			var torso := MeshInstance3D.new()
			var capsule := CapsuleMesh.new()
			capsule.radius = .18
			capsule.height = .65
			torso.mesh = capsule
			torso.material_override = red
			torso.position = Vector3((i - 1) * .65, 1.0, 0)
			result.add_child(torso)
			_simple_box(result, Vector3(.25, .22, .22), Vector3((i - 1) * .65, 1.46, 0), gold)
			for side: int in [-1, 1]:
				_simple_box(result, Vector3(.12, .6, .13), Vector3((i - 1) * .65 + side * .09, .42, 0), dark)
	return result


func _simple_box(parent: Node3D, size: Vector3, at: Vector3, material: Material) -> void:
	var instance := MeshInstance3D.new()
	var geometry := BoxMesh.new()
	geometry.size = size
	instance.mesh = geometry
	instance.material_override = material
	instance.position = at
	parent.add_child(instance)


func _start_run() -> void:
	_reset_touch()
	if _menu != null:
		_menu.queue_free()
		_menu = null
	piece_id = str(data.get("root", pieces.keys()[0]))
	s = float(pieces[piece_id].get("startS", 80.0))
	x = 0.0
	v = 0.0
	vx = 0.0
	yaw = 0.0
	body_roll = 0.0
	body_pitch = 0.0
	_air = 0.0
	_crash = 0.0
	_hit_cd = 0.0
	_shift_cd = 0.0
	_steer = 0.0
	_brake = 0.0
	_drift = false
	gear = 1
	remaining = float(data.get("rules", {}).get("initial_time", 95))
	elapsed = 0.0
	stage_number = 1
	crashes = 0
	passed = 0
	route.assign([piece_id])
	checkpoints.clear()
	traffic.clear()
	traffic.set_player(spec)
	_vehicles.clear()
	_camera_ready = false
	countdown = 3.0
	state = "countdown"
	player.reset_pose()
	_touch_root.show()
	_save.set_value("settings", "car", selected_car)
	_save.set_value("settings", "quality", quality)
	_save.save("user://formosa-progress.cfg")


func _finish(won: bool) -> void:
	if state == "result":
		return
	state = "result"
	v = 0.0
	_touch_root.hide()
	var box: VBoxContainer = _panel()
	_text(box, "抵達寶島終點！" if won else "TIME UP", 40)
	_text(box, str(pieces[piece_id].get("name", piece_id)), 26)
	_text(box, "用時 %.1f 秒　路線 %d 段　碰撞 %d 次" % [elapsed, route.size(), crashes], 20)
	var names: Array[String] = []
	for id: String in route:
		names.append(str(pieces[id].get("name", id)))
	_text(box, " → ".join(names), 17)
	_button(box, "再跑一次　R", _start_run)
	_button(box, "重新選車", _show_selection)
	if won:
		var key: String = "best_" + piece_id
		var previous: float = float(_save.get_value("records", key, INF))
		if elapsed < previous:
			_save.set_value("records", key, elapsed)
			_save.save("user://formosa-progress.cfg")


func _toggle_pause() -> void:
	if state == "pause":
		state = _pause_from
		if _menu != null:
			_menu.queue_free()
			_menu = null
		return
	if state != "run" and state != "countdown":
		return
	_pause_from = state
	state = "pause"
	_reset_touch()
	var box: VBoxContainer = _panel()
	_text(box, "旅程暫停", 40)
	_button(box, "繼續　Esc / P", _toggle_pause)
	_button(box, "重新出發", _start_run)
	_button(box, "重新選車", _show_selection)


func _preview_car(index: int) -> void:
	selected_car = index
	spec = cars[index]
	player.configure(spec)
	_configure_engine(str(spec.get("engine", "v12")))
	traffic.set_player(spec)
	piece_id = str(data.get("root", pieces.keys()[0]))
	s = maxf(80, float(pieces[piece_id].get("startS", 80)))
	x = 0.0
	v = 0.0
	yaw = 0.0
	body_roll = 0.0
	body_pitch = 0.0
	_air = 0.0
	_steer = 0.0
	_brake = 0.0
	player.reset_pose()
	_camera_ready = false


func _configure_engine(kind: String) -> void:
	if not _engine_waves.has(kind):
		var rate: int = 22050
		var samples := PackedByteArray()
		samples.resize(rate * 2)
		var frequency: float = {"v12": 84.0, "v8": 56.0, "i6": 72.0, "i4": 48.0, "flat6": 68.0, "turbo": 96.0}.get(kind, 72.0)
		for i: int in range(rate):
			var phase: float = TAU * frequency * float(i) / rate
			var engine_sample: float = sin(phase) * .48 + sin(phase * 2.0) * .23 + sin(phase * 3.0) * .13 + sin(phase * 7.0) * .045
			samples.encode_s16(i * 2, roundi(clampf(engine_sample * 1.15, -.95, .95) * 23000.0))
		var stream := AudioStreamWAV.new()
		stream.format = AudioStreamWAV.FORMAT_16_BITS
		stream.mix_rate = rate
		stream.stereo = false
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_begin = 0
		stream.loop_end = rate
		stream.data = samples
		_engine_waves[kind] = stream
	_engine_audio.stream = _engine_waves[kind]
	_engine_audio.play()


func _setup_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	_hud_root = Control.new()
	_hud_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_hud_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var theme := Theme.new()
	var font := SystemFont.new()
	font.font_names = PackedStringArray(["Noto Sans TC", "Microsoft JhengHei", "PingFang TC", "sans-serif"])
	theme.default_font = load("res://assets/fonts/NotoSansTC-Regular.ttf") as Font if ResourceLoader.exists("res://assets/fonts/NotoSansTC-Regular.ttf") else font
	theme.default_font_size = 20
	_hud_root.theme = theme
	layer.add_child(_hud_root)
	_location = _label(Vector2(28, 20), 28)
	_timer = _label(Vector2(570, 12), 48)
	_speed = _label(Vector2(-285, -195), 45, Vector2(1, 1))
	_status = _label(Vector2(-285, -137), 18, Vector2(1, 1))
	_fork = _label(Vector2(28, 65), 21)
	_notice = _label(Vector2(350, 170), 38)
	_notice.add_theme_color_override("font_color", Color(1, .86, .3))
	var pause := Button.new()
	pause.text = "Ⅱ"
	pause.position = Vector2(-78, 18)
	pause.size = Vector2(56, 48)
	pause.anchor_left = 1
	pause.anchor_right = 1
	pause.pressed.connect(_toggle_pause)
	_hud_root.add_child(pause)
	_touch_root = Control.new()
	_touch_root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_touch_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud_root.add_child(_touch_root)
	_touch_button("◀", "left", Vector2(25, -105), Vector2(0, 1))
	_touch_button("▶", "right", Vector2(135, -105), Vector2(0, 1))
	_touch_button("煞車", "brake", Vector2(-240, -105), Vector2(1, 1))
	_touch_button("油門", "gas", Vector2(-125, -105), Vector2(1, 1))
	var down := _touch_button("− 檔", "shift_down", Vector2(-350, -105), Vector2(1, 1))
	down.pressed.connect(func():
		if not at_gearbox:
			_shift(-1)
	)
	var up := _touch_button("+ 檔", "shift_up", Vector2(-350, -190), Vector2(1, 1))
	up.pressed.connect(func():
		if not at_gearbox:
			_shift(1)
	)
	_touch_root.hide()


func _label(at: Vector2, font_size: int, anchor: Vector2 = Vector2.ZERO) -> Label:
	var label := Label.new()
	label.position = at
	label.anchor_left = anchor.x
	label.anchor_right = anchor.x
	label.anchor_top = anchor.y
	label.anchor_bottom = anchor.y
	label.add_theme_font_size_override("font_size", font_size)
	label.add_theme_color_override("font_shadow_color", Color(0, .04, .08, .9))
	label.add_theme_constant_override("shadow_offset_x", 2)
	label.add_theme_constant_override("shadow_offset_y", 3)
	label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud_root.add_child(label)
	return label


func _touch_button(text: String, action: String, at: Vector2, anchor: Vector2) -> Button:
	var button := Button.new()
	button.text = text
	button.position = at
	button.size = Vector2(100, 76)
	button.anchor_left = anchor.x
	button.anchor_right = anchor.x
	button.anchor_top = anchor.y
	button.anchor_bottom = anchor.y
	button.modulate = Color(1, 1, 1, .8)
	button.focus_mode = Control.FOCUS_NONE
	if _touch.has(action):
		button.button_down.connect(func(): _touch[action] = true)
		button.button_up.connect(func(): _touch[action] = false)
	if DisplayServer.is_touchscreen_available():
		button.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_touch_buttons[action] = button
	_touch_root.add_child(button)
	return button


func _handle_touch(finger: int, point: Vector2, pressed: bool) -> void:
	if not _touch_root.visible:
		return
	var previous: String = str(_touch_fingers.get(finger, ""))
	var action: String = ""
	if pressed:
		for key: String in _touch_buttons:
			if (_touch_buttons[key] as Button).get_global_rect().has_point(point):
				action = key
				break
	if previous == action:
		return
	_touch_fingers.erase(finger)
	if not action.is_empty():
		_touch_fingers[finger] = action
	for key: String in _touch:
		_touch[key] = _touch_fingers.values().has(key)
	if pressed and not at_gearbox and state == "run":
		if action == "shift_up":
			_shift(1)
		elif action == "shift_down":
			_shift(-1)


func _reset_touch() -> void:
	_touch_fingers.clear()
	for key: String in _touch:
		_touch[key] = false


func _panel() -> VBoxContainer:
	if _menu != null:
		_menu.queue_free()
	_menu = PanelContainer.new()
	_menu.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	_menu.offset_left = -370
	_menu.offset_right = 370
	_menu.offset_top = -270
	_menu.offset_bottom = 270
	var style := StyleBoxFlat.new()
	style.bg_color = Color(.025, .075, .11, .94)
	style.border_color = Color(.28, .68, .75)
	style.set_border_width_all(2)
	style.set_corner_radius_all(18)
	style.content_margin_left = 28
	style.content_margin_right = 28
	style.content_margin_top = 22
	style.content_margin_bottom = 22
	_menu.add_theme_stylebox_override("panel", style)
	_hud_root.add_child(_menu)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 11)
	_menu.add_child(box)
	return box


func _text(parent: Node, value: String, font_size: int) -> Label:
	var label := Label.new()
	label.text = value
	label.add_theme_font_size_override("font_size", font_size)
	label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(label)
	return label


func _button(parent: Node, value: String, callback: Callable) -> Button:
	var button := Button.new()
	button.text = value
	button.custom_minimum_size.y = 44
	button.pressed.connect(callback)
	parent.add_child(button)
	return button


func _show_selection() -> void:
	state = "select"
	_reset_touch()
	_touch_root.hide()
	_vehicles.clear()
	traffic.clear()
	_preview_car(selected_car)
	var box: VBoxContainer = _panel()
	_text(box, "衝向寶島  FORMOSA RUN", 34)
	_text(box, "高雄港出發・臺灣山海公路街機之旅", 19)
	var choices := OptionButton.new()
	for car: Dictionary in cars:
		choices.add_item(str(car.get("name", car.get("id", ""))) + "   ·   " + str(car.get("top", "")) + " km/h")
	choices.select(selected_car)
	choices.item_selected.connect(_preview_car)
	box.add_child(choices)
	_text(box, "10 台原創車款・全部分歧路線・駕駛與副駕共享 3D 模型", 18)
	var gearbox := OptionButton.new()
	gearbox.add_item("AT 自動變速")
	gearbox.add_item("MT 手動變速　Q / E 換檔")
	gearbox.select(0 if at_gearbox else 1)
	gearbox.item_selected.connect(func(i: int): at_gearbox = i == 0)
	box.add_child(gearbox)
	var control := OptionButton.new()
	control.add_item("方向鍵 / WASD / 觸控按鈕")
	control.add_item("手機傾斜轉向 + 觸控")
	control.select(1 if tilt_control else 0)
	control.item_selected.connect(func(i: int): tilt_control = i == 1)
	box.add_child(control)
	var automatic := CheckButton.new()
	automatic.text = "自動踩油門（仍可用 ↓ / S / 空白鍵煞車甩尾）"
	automatic.button_pressed = auto_throttle
	automatic.toggled.connect(func(on: bool): auto_throttle = on)
	box.add_child(automatic)
	var quality_choice := OptionButton.new()
	quality_choice.add_item("高畫質")
	quality_choice.add_item("手機效能模式")
	quality_choice.select(0 if quality == "high" else 1)
	quality_choice.item_selected.connect(func(i: int): quality = "high" if i == 0 else "mobile")
	box.add_child(quality_choice)
	_text(box, "限時抵達檢查點加時；路口靠左或靠右選路。Esc 暫停，R 重跑。", 17)
	_button(box, "發動出發", _start_run)


func _show_error(message: String) -> void:
	var box: VBoxContainer = _panel()
	_text(box, "衝向寶島", 40)
	_text(box, message, 22)


func _notice_message(message: String, seconds: float) -> void:
	_notice.text = message
	_notice_time = seconds


func _update_hud() -> void:
	_location.text = str(pieces[piece_id].get("name", piece_id)) + "  ·  STAGE %d" % stage_number
	_timer.text = "TIME  %02d" % ceili(maxf(0, remaining))
	_speed.text = "%03d km/h" % roundi(v * 3.6)
	_status.text = "%s  %d 檔   %d RPM%s" % ["AT" if at_gearbox else "MT", gear, roundi(rpm), "  DRIFT" if _drift else ""]
	var children: Array = pieces[piece_id].get("children", [])
	if state == "run" and children.size() == 2 and float(pieces[piece_id].get("length", 0)) - s < 540:
		_fork.text = "← " + str(pieces[str(children[0])].get("name", children[0])) + "    |    " + str(pieces[str(children[1])].get("name", children[1])) + " →"
	else:
		_fork.text = ""
	_notice.visible = state == "countdown" or _notice_time > 0.0
