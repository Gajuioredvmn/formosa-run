extends Node
## Traffic simulation shared in shape with the browser: road metres, lateral metres and m/s.
## setup(data), set_player(car), set_external_obstacles(records), update_traffic(...).
## Render `vehicles`; apply `collision_events` to the player's physics exactly once per update.

const LANE: float = 3.7
const MARGIN: float = 0.24
const CLEARANCE: float = 0.32
const ContactPhysics = preload("res://godot/scripts/vehicle.gd")
const SHAPES: Dictionary = {
	"sedan": Vector2(4.5, 1.8), "taxi": Vector2(4.6, 1.8), "pickup": Vector2(5.0, 1.9),
	"bluetruck": Vector2(4.8, 1.7), "bus": Vector2(11.5, 2.5), "gravel": Vector2(8.0, 2.5),
	"scooter": Vector2(1.9, 0.8), "suv": Vector2(4.8, 1.9), "wagon": Vector2(4.7, 1.8),
	"rebar": Vector2(17.0, 2.5), "logs": Vector2(16.0, 2.5), "train": Vector2(12.0, 2.8)
}

var vehicles: Array[Dictionary] = []
var collision_events: Array[Dictionary] = []
var external_obstacles: Array[Dictionary] = []
var player_width: float = 1.85
var player_length: float = 4.4
var player_mass_kg: float = 1450.0
var stats: Dictionary = {"spawned": 0, "yielded": 0, "blocked_spawns": 0, "collisions": 0}
var _rng := RandomNumberGenerator.new()
var _piece: Dictionary = {}
var _piece_id: String = ""
var _player_s: float = 0.0
var _player_x: float = 0.0
var _player_speed: float = 0.0
var _player_vx: float = 0.0
var _time: float = 0.0
var _spawn_timer: float = 0.0
var _train_timer: float = 2.0
var _edge_next_s: float = 180.0
var _edge_side: int = 1
var _uid: int = 0
var _parades_done: Dictionary = {}
var _data: Dictionary = {}
var _sample_cache: Dictionary = {}
var _plan: Array[Vector2] = []
var _plan_piece: String = ""
var _plan_time: float = -100.0
var _plan_start: float = 0.0

func setup(data: Dictionary) -> void:
	_data = data
	_rng.seed = int(data.get("traffic_seed", 19470528))
	clear()

func set_player(spec: Dictionary) -> void:
	player_width = maxf(1.5, float(spec.get("W", spec.get("width", 1.85))))
	player_length = maxf(3.6, float(spec.get("L", spec.get("length", 4.4))))
	player_mass_kg = ContactPhysics.player_mass_kg(spec)
	_plan.clear()
	_plan_time = -100.0

func set_external_obstacles(records: Array) -> void:
	external_obstacles.clear()
	for record in records:
		if record is Dictionary:
			external_obstacles.append(record)
	_plan_time = -100.0

func clear() -> void:
	vehicles.clear()
	collision_events.clear()
	external_obstacles.clear()
	_piece_id = ""
	_spawn_timer = 0.0
	_train_timer = 2.0
	_edge_next_s = 180.0
	_parades_done.clear()
	_plan.clear()
	_plan_time = -100.0

func update_traffic(dt: float, piece_or_id: Variant, s: float, player_x: float, player_speed: float, player_lateral_speed: float = 0.0) -> Array[Dictionary]:
	dt = clampf(dt, 0.0, 0.05)
	var piece: Dictionary = piece_or_id if piece_or_id is Dictionary else _resolve_piece(str(piece_or_id))
	if piece.is_empty():
		collision_events.clear()
		return vehicles
	_piece = piece
	_sample_cache.clear()
	var new_id := str(piece.get("id", ""))
	if new_id != _piece_id:
		vehicles.clear()
		_piece_id = new_id
		_edge_next_s = s + 160.0
		_spawn_timer = 0.0
		_train_timer = 2.0
		_plan.clear()
		_plan_time = -100.0
	_player_s = s
	_player_x = player_x
	_player_speed = player_speed
	_player_vx = player_lateral_speed
	_time += dt
	collision_events.clear()
	_spawn_timer -= dt
	_train_timer -= dt
	var section := _section(s)
	if bool(section.get("track", false)):
		if _train_timer <= 0.0:
			_spawn_train(section)
			_train_timer = _rng.randf_range(8.0, 12.0)
	else:
		_train_timer = 2.0
		if _spawn_timer <= 0.0 and vehicles.size() < 24:
			_spawn_regular(_player_s + _rng.randf_range(430.0, 740.0))
			_spawn_timer = _rng.randf_range(0.55, 1.1)
		if s >= _edge_next_s:
			_edge_side *= -1
			_edge_next_s = s + _rng.randf_range(240.0, 340.0)
			var slow_s := s + _rng.randf_range(400.0, 490.0)
			var bounds := _limits(slow_s)
			_spawn_regular(slow_s, "scooter", bounds.x + 0.65 if _edge_side < 0 else bounds.y - 0.65, true)
	_spawn_parades()
	for index in range(vehicles.size() - 1, -1, -1):
		var vehicle: Dictionary = vehicles[index]
		if float(vehicle.s) < s - 85.0 or float(vehicle.s) > float(piece.get("length", piece.get("L", 0.0))) - 2.0:
			vehicles.remove_at(index)
			continue
		var previous_x: float = float(vehicle.x)
		_update_vehicle(vehicle, dt)
		var impact_vx: float = float(vehicle.get("impact_vx", 0.0))
		if absf(impact_vx) > .001:
			if not _collision_move(vehicle, float(vehicle.s), float(vehicle.x) + impact_vx * dt):
				impact_vx = 0.0
			vehicle.impact_vx = move_toward(impact_vx, 0.0, dt * 3.0)
		vehicle.vx = (float(vehicle.x) - previous_x) / dt if dt > .000001 else float(vehicle.get("vx", 0.0))
		_test_player_collision(vehicle)
	return vehicles

func _resolve_piece(id: String) -> Dictionary:
	var pieces: Variant = _data.get("pieces", [])
	if pieces is Dictionary:
		return pieces.get(id,{})
	for candidate in pieces:
		if str(candidate.get("id",""))==id:
			return candidate
	return {}

func get_vehicles() -> Array[Dictionary]:
	return vehicles

func get_collision_events() -> Array[Dictionary]:
	return collision_events

func _length() -> float:
	return float(_piece.get("length", _piece.get("L", 0.0)))

func _sample(distance: float) -> Dictionary:
	var cache_key := int(round(distance*4.0))
	if _sample_cache.has(cache_key):
		return _sample_cache[cache_key]
	var points: Array = _piece.get("points", [])
	if points.is_empty():
		return {"hw": 3.7, "left": -3.7, "right": 5.2}
	var low: int = 0
	var high: int = points.size() - 1
	while low < high:
		var middle: int = (low + high) / 2
		if float(points[middle].get("s", 0.0)) < distance:
			low = middle + 1
		else:
			high = middle
	var b: Dictionary = points[low]
	var a: Dictionary = points[maxi(0, low - 1)]
	var ratio := clampf((distance-float(a.get("s",0.0)))/maxf(0.001,float(b.get("s",0.0))-float(a.get("s",0.0))),0.0,1.0)
	var result: Dictionary = {}
	for key in ["hw", "left", "right"]:
		result[key] = lerpf(float(a.get(key, 3.7 if key == "hw" else -3.7 if key == "left" else 5.2)),float(b.get(key,a.get(key,3.7))),ratio)
	_sample_cache[cache_key] = result
	return result

func _limits(distance: float) -> Vector2:
	var point := _sample(distance)
	return Vector2(float(point.get("left", -float(point.get("hw", 3.7)))),float(point.get("right",float(point.get("hw",3.7)))))

func _section(distance: float) -> Dictionary:
	var sections: Array = _piece.get("sections", [])
	for section in sections:
		if distance >= float(section.get("start",0.0)) and distance < float(section.get("end",_length()+1.0)):
			return section
	return sections.back() if not sections.is_empty() else {}

func _obstacles_at(distance: float) -> Array[Vector2]:
	var intervals: Array[Vector2] = []
	for collection in [vehicles, external_obstacles]:
		for obstacle in collection:
			if str(obstacle.get("piece_id",_piece_id)) != _piece_id or bool(obstacle.get("smoke",false)) or bool(obstacle.get("elevated",false)):
				continue
			var length := float(obstacle.get("len",obstacle.get("length",0.7)))
			if absf(float(obstacle.get("s",0.0))-distance) >= (length+player_length)*0.5:
				continue
			var x := float(obstacle.get("x",0.0))
			var width := float(obstacle.get("wid",obstacle.get("width",0.65)))
			intervals.append(Vector2(x-width*0.5-CLEARANCE,x+width*0.5+CLEARANCE))
	for solid in _piece.get("hdColliders", _piece.get("colliders", [])):
		if str(solid.get("kind","solid")) == "none":
			continue
		if float(solid.get("s0",0.0)) < distance+player_length*0.5 and float(solid.get("s1",0.0)) > distance-player_length*0.5:
			intervals.append(Vector2(float(solid.get("x0",0.0))-CLEARANCE,float(solid.get("x1",0.0))+CLEARANCE))
	intervals.sort_custom(func(a: Vector2,b: Vector2) -> bool: return a.x < b.x)
	return intervals

func free_intervals(distance: float) -> Array[Vector2]:
	var bounds := _limits(distance)
	var radius := player_width*0.5+MARGIN
	var cursor := bounds.x+radius
	var maximum := bounds.y-radius
	var free: Array[Vector2] = []
	for raw in _obstacles_at(distance):
		var block := Vector2(raw.x-radius,raw.y+radius)
		if block.y <= cursor or block.x >= maximum:
			continue
		if block.x > cursor:
			free.append(Vector2(cursor,minf(block.x,maximum)))
		cursor = maxf(cursor,block.y)
		if cursor >= maximum:
			break
	if cursor < maximum:
		free.append(Vector2(cursor,maximum))
	return free

func passage_open(from: float, to: float) -> bool:
	from = maxf(0.0,from)
	to = minf(_length(),to)
	if to <= from:
		return true
	var rows: Array[float] = [from,to]
	for collection in [vehicles,external_obstacles]:
		for obstacle in collection:
			if str(obstacle.get("piece_id",_piece_id))==_piece_id and not bool(obstacle.get("smoke",false)) and not bool(obstacle.get("elevated",false)):
				_mark_rows(rows,float(obstacle.get("s",0.0)),float(obstacle.get("len",0.7)),from,to)
	for solid in _piece.get("hdColliders",_piece.get("colliders",[])):
		if str(solid.get("kind","solid"))!="none":
			_mark_rows(rows,(float(solid.get("s0",0.0))+float(solid.get("s1",0.0)))*0.5,float(solid.get("s1",0.0))-float(solid.get("s0",0.0)),from,to)
	var cursor := from+60.0
	while cursor<to:
		rows.append(cursor)
		cursor += 60.0
	rows.sort()
	var reachable := free_intervals(from)
	if reachable.is_empty():
		return false
	var history: Array[Dictionary] = [{"s":from,"free":reachable}]
	for step in range(1,rows.size()):
		var stride := rows[step]-rows[step-1]
		if stride<0.00001:
			continue
		var available := free_intervals(rows[step])
		var next: Array[Vector2] = []
		for origin in reachable:
			for target in available:
				var low := maxf(origin.x-stride*0.24,target.x)
				var high := minf(origin.y+stride*0.24,target.y)
				if high >= low:
					next.append(Vector2(low,high))
		if next.is_empty():
			return false
		next.sort_custom(func(a: Vector2,b: Vector2) -> bool: return a.x < b.x)
		reachable = []
		for interval in next:
			if not reachable.is_empty() and interval.x <= reachable.back().y:
				reachable[reachable.size()-1].y = maxf(reachable.back().y,interval.y)
			else:
				reachable.append(interval)
		history.append({"s":rows[step],"free":reachable})
	var rebuilt: Array[Vector2] = []
	var next_x: float = 0.0
	var next_s: float = to
	for index in range(history.size()-1,-1,-1):
		var row: Dictionary = history[index]
		var reach: float = INF if index==history.size()-1 else (next_s-float(row.s))*0.24
		var desired: float = sin(float(row.s)*0.006)*float(_sample(float(row.s)).get("hw",3.7))*0.6 if index==history.size()-1 else next_x
		var best: float = INF
		var best_distance: float = INF
		for interval in row.free:
			var low: float = maxf(interval.x,next_x-reach)
			var high: float = minf(interval.y,next_x+reach)
			if high<low:
				continue
			var pad: float = minf(0.04,(high-low)*0.25)
			var x: float = clampf(desired,low+pad,high-pad)
			if absf(x-desired)<best_distance:
				best = x
				best_distance = absf(x-desired)
		if not is_finite(best):
			return false
		rebuilt.append(Vector2(float(row.s),best))
		next_x = best
		next_s = float(row.s)
	rebuilt.reverse()
	_plan = rebuilt
	_plan_piece = _piece_id
	_plan_time = _time
	_plan_start = from
	return true

func _mark_rows(rows: Array[float], at: float, length: float, from: float, to: float) -> void:
	var half := (length+player_length)*0.5
	for distance in [at-half-0.02,at-half+0.02,at,at+half-0.02,at+half+0.02]:
		if distance>from and distance<to:
			rows.append(distance)

func _safe_move(vehicle: Dictionary, next_s: float, next_x: float) -> bool:
	if _plan_piece!=_piece_id or _plan.size()<2 or _time-_plan_time>0.25 or absf(maxf(0.0,_player_s-12.0)-_plan_start)>15.0 or _plan.back().x<minf(_length(),_player_s+800.0):
		passage_open(maxf(0.0,_player_s-12.0),_player_s+840.0)
	if _plan_piece==_piece_id and _plan.size()>=2:
		var low: float = next_s-(float(vehicle.get("len",4.5))+player_length)*0.5
		var high: float = next_s+(float(vehicle.get("len",4.5))+player_length)*0.5
		var radius: float = (float(vehicle.get("wid",1.8))+player_width)*0.5+CLEARANCE+MARGIN
		var safe: bool = true
		for index in range(1,_plan.size()):
			var a: Vector2 = _plan[index-1]
			var b: Vector2 = _plan[index]
			if b.x<low or a.x>high:
				continue
			var span: float = b.x-a.x
			if span<0.00001:
				continue
			var xa: float = lerpf(a.y,b.y,clampf((low-a.x)/span,0.0,1.0))
			var xb: float = lerpf(a.y,b.y,clampf((high-a.x)/span,0.0,1.0))
			if maxf(xa,xb)>=next_x-radius-0.000001 and minf(xa,xb)<=next_x+radius+0.000001:
				safe = false
				break
		if safe:
			vehicle.s = next_s
			vehicle.x = next_x
			return true
	stats.yielded = int(stats.yielded)+1
	return false

func _spawn_regular(distance: float, forced_type: String = "", forced_x: float = INF, slow: bool = false) -> bool:
	if distance > _length()-25.0:
		return false
	var section := _section(distance)
	if bool(section.get("track",false)):
		return false
	var types := ["sedan","taxi","bluetruck","scooter","bus","suv","pickup"]
	var type: String = forced_type if not forced_type.is_empty() else types[_rng.randi_range(0,types.size()-1)]
	var dimensions: Vector2 = SHAPES.get(type,SHAPES.sedan)
	var point := _sample(distance)
	var half_width := float(point.get("hw",3.7))
	var lanes := maxi(1,int(round(half_width*2.0/LANE)))
	var choices: Array[float] = []
	if is_finite(forced_x):
		choices.append(forced_x)
	var lane_offset := _rng.randi_range(0,lanes-1)
	for index in range(lanes):
		choices.append(-half_width+LANE*(float((index+lane_offset)%lanes)+0.5)+_rng.randf_range(-0.2,0.2))
	for x in choices:
		var bounds := _limits(distance)
		if x-dimensions.y*0.5 <= bounds.x+0.12 or x+dimensions.y*0.5 >= bounds.y-0.12:
			continue
		_uid += 1
		var speed := _rng.randf_range(8.0,12.0) if slow else _rng.randf_range(11.0,16.0) if type=="scooter" else _rng.randf_range(16.0,24.0)
		var record: Dictionary = {"id":_uid,"piece_id":_piece_id,"s":distance,"x":x,"v":speed,"v0":speed,"len":dimensions.x,"wid":dimensions.y,"type":type,"kind":"traffic","target_x":x,"signal":0,"signal_time":0.0,"change_time":_rng.randf_range(4.0,10.0),"brake":0.0,"edge_user":slow,"hit_until":0.0}
		vehicles.append(record)
		if passage_open(maxf(0.0,_player_s-12.0),maxf(_player_s+810.0,distance+24.0)):
			stats.spawned = int(stats.spawned)+1
			return true
		vehicles.pop_back()
	stats.blocked_spawns = int(stats.blocked_spawns)+1
	return false

func _spawn_train(section: Dictionary) -> void:
	var distance := minf(float(section.get("end",_length()))-45.0,_player_s+_rng.randf_range(420.0,540.0))
	if distance < _player_s+180.0:
		return
	var hw := float(_sample(distance).get("hw",3.7))
	var tracks := maxi(1,int(round(hw*2.0/LANE)))
	var track := _rng.randi_range(0,tracks-1)
	var first := vehicles.size()
	for index in range(3):
		_uid += 1
		vehicles.append({"id":_uid,"piece_id":_piece_id,"s":distance+index*12.5,"x":-hw+LANE*(track+0.5),"v":-16.0,"v0":-16.0,"len":12.0,"wid":2.8,"type":"train","kind":"train","train":true,"oncoming":true,"signal":0,"brake":0.0,"hit_until":0.0})
	if not passage_open(maxf(0.0,_player_s-12.0),_player_s+810.0):
		vehicles.resize(first)
		stats.blocked_spawns = int(stats.blocked_spawns)+1

func _spawn_parades() -> void:
	for parade in _piece.get("parades",[]):
		var at := float(parade.get("s",0.0))
		var key := _piece_id+":"+str(at)
		if _parades_done.has(key) or at-_player_s>420.0 or at<_player_s-30.0:
			continue
		_parades_done[key] = true
		var hw := float(_sample(at).get("hw",3.7))
		for index in range(6):
			_uid += 1
			var record := {"id":_uid,"piece_id":_piece_id,"s":at+index*6.0,"x":-hw+1.5,"v":1.3,"v0":1.3,"len":3.0,"wid":2.2,"type":"palanquin" if index==3 else "marchers","kind":"parade","parade":true,"signal":0,"brake":0.0,"hit_until":0.0}
			vehicles.append(record)
			if not passage_open(maxf(0.0,_player_s-12.0),_player_s+810.0):
				vehicles.pop_back()

func _update_vehicle(vehicle: Dictionary, dt: float) -> void:
	var desired := float(vehicle.v0)
	if bool(vehicle.get("train",false)):
		# A locomotive cannot instantly restore velocity lost to an impact.
		var next_v: float = move_toward(float(vehicle.v), desired, dt * .45)
		vehicle.v = next_v if _safe_move(vehicle,float(vehicle.s)+next_v*dt,float(vehicle.x)) else 0.0
		return
	for leader in vehicles:
		if leader.id == vehicle.id or float(leader.s)<=float(vehicle.s):
			continue
		if absf(float(leader.x)-float(vehicle.x))<(float(leader.wid)+float(vehicle.wid))*0.5+0.4:
			var separation := float(leader.s)-float(vehicle.s)-(float(leader.len)+float(vehicle.len))*0.5
			if separation<28.0:
				desired = minf(desired,maxf(0.0,float(leader.v)+(separation-9.0)*0.7))
	vehicle.brake = 1.0 if desired < float(vehicle.v)-0.5 else 0.0
	vehicle.v = move_toward(float(vehicle.v),desired,dt*(12.0 if desired<float(vehicle.v) else 4.0))
	if not _safe_move(vehicle,float(vehicle.s)+float(vehicle.v)*dt,float(vehicle.x)):
		vehicle.v = 0.0
		vehicle.brake = 1.0
	if bool(vehicle.get("parade",false)):
		return
	vehicle.change_time = float(vehicle.get("change_time",8.0))-dt
	if float(vehicle.change_time)<=0.0 and int(vehicle.signal)==0:
		var hw := float(_sample(float(vehicle.s)).get("hw",3.7))
		var lanes := maxi(1,int(round(hw*2.0/LANE)))
		var current := clampi(int(round((float(vehicle.x)+hw)/LANE-0.5)),0,lanes-1)
		var direction := 1 if current==0 else -1 if current==lanes-1 else (-1 if _rng.randf()<0.5 else 1)
		var target := -hw+LANE*(current+direction+0.5)
		var warning := _rng.randf_range(1.1,1.8)
		var need := maxf(55.0,(_player_speed-float(vehicle.v))*(warning+1.8))
		if lanes>1 and not (float(vehicle.s)-_player_s<need and absf(target-_player_x)<player_width+0.5):
			vehicle.target_x = target
			vehicle.signal = direction
			vehicle.signal_time = warning
		vehicle.change_time = _rng.randf_range(6.0,14.0)
	if int(vehicle.signal)!=0:
		vehicle.signal_time = float(vehicle.signal_time)-dt
		if float(vehicle.signal_time)<=0.0:
			var next_x := move_toward(float(vehicle.x),float(vehicle.target_x),dt*(1.4 if str(vehicle.type)=="scooter" else 2.0))
			if _safe_move(vehicle,float(vehicle.s),next_x) and absf(float(vehicle.x)-float(vehicle.target_x))<0.05:
				vehicle.signal = 0

func _test_player_collision(vehicle: Dictionary) -> void:
	var cooling_down: bool = float(vehicle.get("hit_until", 0.0)) > _time
	var ds := float(vehicle.s)-_player_s
	var dx := float(vehicle.x)-_player_x
	var total_width := (float(vehicle.wid)+player_width)*0.5
	if absf(ds)>=(float(vehicle.len)+player_length)*0.5 or absf(dx)>=total_width:
		return
	var relative: Vector2 = Vector2(_player_speed - float(vehicle.v), _player_vx - float(vehicle.get("vx", 0.0)))
	var frontal: bool = total_width - absf(dx) > total_width * .55
	var n: Vector2 = Vector2(signf(ds if ds != 0.0 else relative.x if relative.x != 0.0 else 1.0), 0.0) if frontal else Vector2(0.0, signf(dx if dx != 0.0 else relative.y if relative.y != 0.0 else 1.0))
	var other_mass: float = ContactPhysics.traffic_mass_kg(vehicle)
	var result: Dictionary = ContactPhysics.solve_vehicle_impulse({"v":_player_speed,"vx":_player_vx,"massKg":player_mass_kg}, {"v":float(vehicle.v),"vx":float(vehicle.get("vx", 0.0)),"massKg":other_mass}, n)
	var lever: Vector2 = Vector2(signf(ds) * player_length * .5 if frontal else clampf(ds * .5, -player_length * .5, player_length * .5), clampf(dx * .5, -player_width * .5, player_width * .5))
	var yaw_impulse: float = ContactPhysics.contact_yaw_impulse(result, lever, player_mass_kg, player_length, player_width)
	var normal_speed: float = float(result.normal_speed_mps)
	var response: Dictionary = ContactPhysics.evaluate_contact(relative.length(), atan2(float(result.tangent_speed_mps), normal_speed), other_mass / player_mass_kg,
		{"massKg":player_mass_kg,"width":player_width,"dissipated_energy":result.dissipated_energy,"yaw_impulse":yaw_impulse})
	collision_events.append({"type":"train" if bool(vehicle.get("train",false)) else "rear" if frontal else "scrape", "object":vehicle.id,"closing":normal_speed,
		"normal":n,"solution":result,"response":response,"player_v":result.a.v,"player_vx":result.a.vx,"other_v":result.b.v,"other_vx":result.b.vx,
		"yaw_impulse":yaw_impulse,"severity":clampf(normal_speed/50.0,0.0,1.0),"crash":normal_speed>24.0,"cooldown":.45,"separation_only":cooling_down,
		"separation":Vector2(minf(.18,maxf(0.0, (float(vehicle.len)+player_length)*.5-absf(ds)-.02)*.35) if frontal else 0.0, minf(.18,maxf(0.0,total_width-absf(dx)-.02)*.35) if not frontal else 0.0)})


func _collision_move(vehicle: Dictionary, next_s: float, next_x: float) -> bool:
	var limits: Vector2 = _limits(next_s)
	var half: float = float(vehicle.get("wid", 1.8)) * .5 + MARGIN
	return _safe_move(vehicle, next_s, clampf(next_x, limits.x + half, limits.y - half))


func commit_contact(contact: Dictionary, apply_velocity: bool = true) -> void:
	## Main accepts the event first; only then are both momentum changes committed.
	for vehicle in vehicles:
		if vehicle.id != contact.get("object"):
			continue
		if apply_velocity:
			vehicle.v = float(contact.get("other_v", vehicle.v))
			var previous_vx: float = float(vehicle.get("vx", 0.0))
			vehicle.vx = float(contact.get("other_vx", vehicle.get("vx", 0.0)))
			# Existing AI lane-change velocity is already integrated next frame.
			vehicle.impact_vx = float(vehicle.get("impact_vx", 0.0)) + float(vehicle.vx) - previous_vx
			vehicle.hit_until = _time + .6
			stats.collisions = int(stats.collisions) + 1
		var n: Vector2 = contact.get("normal", Vector2.ZERO)
		var separation: Vector2 = contact.get("separation", Vector2.ZERO)
		var ratio: float = player_mass_kg / (player_mass_kg + ContactPhysics.traffic_mass_kg(vehicle))
		_collision_move(vehicle, float(vehicle.s) + n.x * separation.x * ratio, float(vehicle.x) + n.y * separation.y * ratio)
		return
