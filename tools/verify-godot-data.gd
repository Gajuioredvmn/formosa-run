extends SceneTree
## Headless shared-data validation; this does not certify native visual parity.

func _initialize() -> void:
	var failures: Array[String] = []
	var parsed: Variant = JSON.parse_string(FileAccess.get_file_as_string("res://data/game.json"))
	if not parsed is Dictionary:
		push_error("Shared game data cannot be parsed")
		quit(1)
		return
	var data: Dictionary = parsed
	var cars: Array = data.get("cars", [])
	var pieces: Array = data.get("pieces", [])
	var ids: Dictionary = {}
	var endings: int = 0
	var boundaries: int = 0
	var crossings: int = 0
	var pedestrian_passages: int = 0
	if cars.size() != 10:
		failures.append("Expected ten cars")
	if pieces.size() != 31:
		failures.append("Expected thirty-one route pieces")
	for piece: Dictionary in pieces:
		var id: String = str(piece.get("id", ""))
		if id.is_empty() or ids.has(id):
			failures.append("Duplicate or missing route id")
		ids[id] = true
		var points: Array = piece.get("points", [])
		if points.is_empty():
			failures.append(id + ": missing geometry")
		for point: Dictionary in points:
			for key: String in ["s", "x", "y", "z", "h", "hw", "left", "right"]:
				if not point.has(key) or not is_finite(float(point[key])):
					failures.append(id + ": invalid " + key)
		if piece.get("children", []).is_empty():
			endings += 1
		var edges: Array = piece.get("roadBoundaries", [])
		if edges.is_empty():
			failures.append(id + ": missing road-edge records")
		boundaries += edges.size()
		for edge: Dictionary in edges:
			if float(edge.get("s1", 0)) <= float(edge.get("s0", 0)) or float(edge.get("height", 0)) < 0.6:
				failures.append(id + ": invalid barrier extent")
		for passage: Dictionary in piece.get("roadCrossings", []):
			pedestrian_passages += 1
			if float(passage.get("width", 0)) <= 0 or float(passage.get("width", 0)) > 1.45 or float(passage.get("s", -1)) < 0 or float(passage.get("s", 0)) > float(piece.get("length", 0)):
				failures.append(id + ": invalid narrow passage")
		if piece.get("railCrossing") is Dictionary:
			crossings += 1
			if id != "s4b":
				failures.append("Jiji crossing belongs to another route")
			var crossing: Dictionary = piece.railCrossing
			if not crossing.has("axis") or float(crossing.get("axis", 0)) >= -1.5:
				failures.append("Jiji local-street divider must leave the original road centre in the through underpass")
			if float(crossing.get("height", 0)) - 0.48 < 4.6:
				failures.append("Jiji underpass deck is below the shared vehicle clearance")
	for piece: Dictionary in pieces:
		for child: String in piece.get("children", []):
			if not ids.has(child):
				failures.append("Unresolved branch: " + child)
	if endings != 16 or crossings != 1:
		failures.append("Ending or railway count is incorrect")
	for file: String in ["main", "world", "vehicle", "traffic"]:
		var script: Resource = load("res://godot/scripts/" + file + ".gd")
		if script == null or not script.can_instantiate():
			failures.append(file + ": script cannot instantiate")
	var report: Dictionary = {"pass": failures.is_empty(), "engine": Engine.get_version_info().string, "cars": cars.size(), "pieces": pieces.size(), "endings": endings, "barrier_intervals": boundaries, "rail_crossings": crossings, "pedestrian_passages": pedestrian_passages, "failures": failures, "scope": "Shared JSON and native scripts only; current web art and new behavior are not certified as native features."}
	var arguments: PackedStringArray = OS.get_cmdline_user_args()
	if not arguments.is_empty():
		var output: FileAccess = FileAccess.open(arguments[0], FileAccess.WRITE)
		if output:
			output.store_string(JSON.stringify(report, "  "))
	print(JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
