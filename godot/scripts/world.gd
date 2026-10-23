class_name FormosaWorld
extends Node3D
## The same metre-based Piece centreline used by the web game. Positive lateral
## X is right; heading zero faces -Z. Geometry is streamed in 240 metre chunks.
## setup({pieces:[{id,stageId,length,parent,children,points,sections,sign}]})
## points: [{s,x,y,z,h,hw,left,right,secIndex}], sections: [{start,end,L,R,tags}].

const CHUNK: float = 240.0
const SEA_TYPES: Array[String] = ["harbor", "beach", "bay", "shore", "cliff", "pebble", "mudflat"]
const WATER_TYPES: Array[String] = ["harbor", "beach", "bay", "shore", "cliff", "pebble", "mudflat", "water", "lake", "river", "fishpond", "milkfish"]
const HILL_TYPES: Array[String] = ["hills", "mountain", "slope", "highland", "tea", "daylily", "cabbage"]
const FIELD_TYPES: Array[String] = ["farm", "paddy", "tea", "cabbage", "pineapple", "daylily", "cane", "salt", "fishpond", "milkfish"]
const URBAN_TYPES: Array[String] = ["city", "town", "plaza"]
# Fictional businesses are selected by stage, so a shared harbour or hillside
# biome cannot accidentally show another county's place names.
const REGIONAL_SHOPS: Dictionary = {
	"s1": ["高雄港", "港都海產", "鹽埕小吃", "寶島旅宿", "便利商店"],
	"s2n": ["台南小吃", "府城茶行", "牛肉湯", "府城旅宿", "便利商店"],
	"s2s": ["旗津海產", "海景咖啡", "旗津冰品", "海風旅宿", "便利商店"],
	"s3w": ["鹿港茶行", "海線小吃", "海味料理", "老街旅宿", "便利商店"],
	"s3m": ["嘉義雞肉飯", "阿里山茶", "山城咖啡", "山居旅宿", "便利商店"],
	"s3sm": ["屏東鮮果", "沿山小吃", "山城咖啡", "山居旅宿", "便利商店"],
	"s3se": ["東港海產", "屏東鮮果", "海線小吃", "港邊旅宿", "便利商店"],
	"s4a": ["台中茶行", "大甲小吃", "在地鮮果", "寶島旅宿", "便利商店"],
	"s4b": ["集集茶行", "南投鮮果", "山城咖啡", "山居旅宿", "便利商店"],
	"s4c": ["台東鮮果", "縱谷小吃", "在地茶行", "縱谷旅宿", "便利商店"],
	"s4d": ["牡丹小吃", "旭海鮮果", "山城咖啡", "海風旅宿", "便利商店"],
	"s4e": ["恆春小吃", "墾丁冰品", "海景咖啡", "南國旅宿", "便利商店"],
	"s4f": ["北港小吃", "北港茶行", "老街糕餅", "在地旅宿", "便利商店"],
	"s4g": ["三義茶行", "客庄小吃", "客庄咖啡", "山城旅宿", "便利商店"],
	"s4h": ["枋山芒果", "海景咖啡", "枋山鮮果", "海風旅宿", "便利商店"],
	"s5a": ["台北茶行", "淡水魚丸", "河岸咖啡", "台北旅宿", "便利商店"],
	"s5b": ["北海岸海產", "金山小吃", "海景咖啡", "海風旅宿", "便利商店"],
	"s5c": ["湖畔咖啡", "日月潭紅茶", "湖邊小吃", "湖畔旅宿", "便利商店"],
	"s5d": ["高山鮮蔬", "山城咖啡", "高山茶行", "山居旅宿", "便利商店"],
	"s5e": ["花蓮小吃", "峽谷咖啡", "在地茶行", "山居旅宿", "便利商店"],
	"s5f": ["宜蘭小吃", "南方澳海產", "海景咖啡", "蘭陽旅宿", "便利商店"],
	"s5g": ["滿州茶行", "海景咖啡", "在地小吃", "海風旅宿", "便利商店"],
	"s5h": ["墾丁冰品", "海景咖啡", "南國小吃", "海風旅宿", "便利商店"],
	"s5i": ["白沙冰品", "恆春小吃", "海景咖啡", "海風旅宿", "便利商店"],
	"s5j": ["南灣冰品", "海景咖啡", "墾丁小吃", "南灣旅宿", "便利商店"],
	"s5k": ["高美小吃", "海景咖啡", "台中茶行", "海風旅宿", "便利商店"],
	"s5l": ["南寮海產", "新竹米粉", "海景咖啡", "竹塹旅宿", "便利商店"],
	"s5m": ["客庄小吃", "南庄茶行", "桂花茶飲", "客庄旅宿", "便利商店"],
	"s5n": ["九份茶館", "山城小吃", "老街茶飲", "山城旅宿", "便利商店"],
	"s5o": ["成功海產", "台東鮮果", "海景咖啡", "東海岸旅宿", "便利商店"],
	"s5p": ["石梯港海產", "花蓮小吃", "海景咖啡", "東海岸旅宿", "便利商店"],
}

var stats: Dictionary = {"chunks": 0, "queued": 0, "instances": 0}
var _pieces: Dictionary = {}
var _index_ids: Array[String] = []
var _chunks: Dictionary = {}
var _meshes: Dictionary = {}
var _materials: Dictionary = {}
var _textures: Dictionary = {}
var _sign_materials: Dictionary = {}
var _low: bool = false
var _distance: float = 1400.0
var _clock: float = 0.0
var _build_colliders: Array = []
var _collider_chunks: Dictionary = {}

func setup(data: Dictionary) -> void:
	for chunk in _chunks.values():
		chunk.queue_free()
	_chunks.clear()
	_pieces.clear()
	_index_ids.clear()
	_collider_chunks.clear()
	var source: Array = data.get("pieces", [])
	for i in source.size():
		var p: Dictionary = source[i]
		var pid: String = str(p.get("id", i))
		_index_ids.append(pid)
		p["_id"] = pid
		p["hdColliders"] = []
		p["_length"] = float(p.get("length", p.get("L", 0.0)))
		var points: Array = p.get("points", [])
		if not points.is_empty() and p["_length"] <= 0.0:
			p["_length"] = float(points[-1].get("s", 0.0))
		p["_basin"] = 0.0
		p["_sea_level"] = 0.0
		if not points.is_empty():
			var lowest: float = float(points[0].get("y", 0.0))
			var coast_low: float = INF
			for point in points:
				lowest = minf(lowest, float(point.get("y", 0.0)))
				var sec: Dictionary = _section(p, float(point.s))
				if str(sec.get("L", "")) in SEA_TYPES or str(sec.get("R", "")) in SEA_TYPES:
					coast_low = minf(coast_low, float(point.y))
			p["_basin"] = lowest - 4.5
			p["_sea_level"] = coast_low - 3.0 if is_finite(coast_low) else 0.0
		_pieces[pid] = p
	# Derive fork clearance from the sampled sibling centreline when the compact
	# JSON omits the original Piece.innerFree array. Inner-side scenery must never
	# occupy the other fork's lanes while the two carriageways are still close.
	for pid in _index_ids:
		var p: Dictionary = _pieces[pid]
		var parent_id: String = _resolve_id(p.get("parent"))
		if parent_id.is_empty():
			continue
		var siblings: Array = _pieces[parent_id].get("children", [])
		if siblings.size() != 2:
			continue
		var left_id: String = _resolve_id(siblings[0])
		var right_id: String = _resolve_id(siblings[1])
		var other_id: String = right_id if pid == left_id else left_id
		if other_id.is_empty():
			continue
		p["side"] = -1 if pid == left_id else 1
		if not p.get("innerFree", []).is_empty():
			continue
		var inner_free: Array = []
		for point in p.get("points", []):
			var other: Dictionary = _sample(_pieces[other_id], float(point.s))
			var separation: float = Vector2(float(point.x) - float(other.x), float(point.z) - float(other.z)).length()
			var mine: float = float(point.right) if int(p.side) < 0 else -float(point.left)
			var theirs: float = -float(other.left) if int(p.side) < 0 else float(other.right)
			inner_free.append(maxf(0.0, (separation - mine - theirs) * .5 - .5))
		p["innerFree"] = inner_free
	_make_resources()

func _resolve_id(value: Variant) -> String:
	if value == null:
		return ""
	var key: String = str(value)
	if _pieces.has(key):
		return key
	if value is int and value >= 0 and value < _index_ids.size():
		return _index_ids[value]
	return ""

func sample(piece_id: String, s: float, lateral: float = 0.0) -> Dictionary:
	if not _pieces.has(piece_id):
		return {"x": 0.0, "y": 0.0, "z": 0.0, "h": 0.0, "hw": 7.0, "left": -9.0, "right": 9.0, "secIndex": 0, "position": Vector3.ZERO}
	var q: Dictionary = _sample(_pieces[piece_id], s)
	q["position"] = _position(q, lateral)
	q["x"] = q.position.x
	q["z"] = q.position.z
	return q

func _sample(p: Dictionary, s: float) -> Dictionary:
	var points: Array = p.get("points", [])
	if points.is_empty():
		return {"x": 0.0, "y": 0.0, "z": -s, "h": 0.0, "hw": 7.0, "left": -9.0, "right": 9.0, "k": 0.0, "secIndex": 0}
	var lo: int = 0
	var hi: int = points.size() - 1
	while hi - lo > 1:
		var mid: int = (lo + hi) / 2
		if float(points[mid].s) <= s:
			lo = mid
		else:
			hi = mid
	var a: Dictionary = points[lo]
	var z: Dictionary = points[hi]
	var length: float = maxf(0.001, float(z.s) - float(a.s))
	var t: float = clampf((s - float(a.s)) / length, 0.0, 1.0)
	var q: Dictionary = {}
	for key in ["x", "y", "z", "h", "hw", "left", "right"]:
		q[key] = lerpf(float(a.get(key, 0.0)), float(z.get(key, 0.0)), t)
	q["k"] = (float(z.h) - float(a.h)) / length
	q["secIndex"] = int(a.get("secIndex", 0))
	if s < float(points[0].s) or s > float(points[-1].s):
		var extra: float = s - (float(points[0].s) if s < float(points[0].s) else float(points[-1].s))
		q.x += sin(float(q.h)) * extra
		q.z -= cos(float(q.h)) * extra
	return q

func _position(q: Dictionary, lateral: float = 0.0, height: float = 0.0) -> Vector3:
	return Vector3(float(q.x) + cos(float(q.h)) * lateral, float(q.y) + height, float(q.z) + sin(float(q.h)) * lateral)

func get_colliders(piece_id: String) -> Array:
	return _pieces[piece_id].get("hdColliders", []) if _pieces.has(piece_id) else []

func _solid(p: Dictionary, s: float, lateral: float, half_x: float, half_s: float, kind: String = "solid") -> void:
	if s < 0.0 or s > float(p._length):
		return
	var q: Dictionary = _sample(p, s)
	if absf(lateral) - maxf(-float(q.left), float(q.right)) > 34.0:
		return
	_build_colliders.append({"s0": s - half_s, "s1": s + half_s, "x0": lateral - half_x, "x1": lateral + half_x, "kind": kind})

func _refresh_colliders(piece_id: String) -> void:
	var combined: Array = []
	for group in _collider_chunks.get(piece_id, {}).values():
		combined.append_array(group)
	combined.sort_custom(func(a: Dictionary, z: Dictionary) -> bool: return float(a.s0) < float(z.s0))
	_pieces[piece_id]["hdColliders"] = combined

func _edge(q: Dictionary, sg: int, off: float = 0.0) -> float:
	return float(q.right) + off if sg > 0 else float(q.left) - off

func _room(p: Dictionary, s: float, sg: int) -> float:
	var q: Dictionary = _sample(p, s)
	var room: float = 100000.0
	var free: Array = p.get("innerFree", [])
	if not free.is_empty() and sg == -int(p.get("side", 0)):
		var spacing: float = float(p.get("_length", 1.0)) / maxf(1.0, free.size() - 1)
		room = float(free[clampi(int(s / maxf(.01, spacing)), 0, free.size() - 1)])
	if float(q.k) * sg > .0003:
		room = minf(room, .78 / absf(float(q.k)))
	return room

func _section(p: Dictionary, s: float) -> Dictionary:
	var sections: Array = p.get("sections", p.get("secs", []))
	for sec in sections:
		if s >= float(sec.get("start", 0.0)) and s < float(sec.get("end", p.get("_length", 0.0))) + .01:
			return sec
	return sections[-1] if not sections.is_empty() else {"L": "grass", "R": "grass", "tags": []}

func _texture(path: String) -> Texture2D:
	if _textures.has(path):
		return _textures[path]
	if ResourceLoader.exists(path):
		var tex: Texture2D = load(path) as Texture2D
		_textures[path] = tex
		return tex
	return null

func _material(key: String, color: Color, texture_path: String = "", metallic: float = 0.0, roughness: float = .85) -> StandardMaterial3D:
	var mat: StandardMaterial3D = StandardMaterial3D.new()
	mat.albedo_color = color
	mat.vertex_color_use_as_albedo = true
	mat.metallic = metallic
	mat.roughness = roughness
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	if not texture_path.is_empty():
		mat.albedo_texture = _texture(texture_path)
	_materials[key] = mat
	return mat

func _make_resources() -> void:
	if not _meshes.is_empty():
		return
	var box: BoxMesh = BoxMesh.new()
	box.size = Vector3.ONE
	_meshes.box = box
	var pole: CylinderMesh = CylinderMesh.new()
	pole.top_radius = 1.0
	pole.bottom_radius = 1.0
	pole.height = 1.0
	pole.radial_segments = 10
	_meshes.pole = pole
	var trunk: CylinderMesh = CylinderMesh.new()
	trunk.top_radius = .21
	trunk.bottom_radius = .32
	trunk.height = 1.0
	trunk.radial_segments = 12
	_meshes.trunk = trunk
	var ball: SphereMesh = SphereMesh.new()
	ball.radius = 1.0
	ball.height = 2.0
	ball.radial_segments = 12
	ball.rings = 7
	_meshes.ball = ball
	var hill: SphereMesh = SphereMesh.new()
	hill.radius = 1.0
	hill.height = 2.0
	hill.radial_segments = 28
	hill.rings = 16
	_meshes.hill = hill
	var cone: CylinderMesh = CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 1.0
	cone.height = 1.0
	cone.radial_segments = 10
	_meshes.cone = cone
	var photo: QuadMesh = QuadMesh.new()
	photo.size = Vector2.ONE
	_meshes.photo = photo
	_meshes.roof = _roof_mesh()
	var kite_tool: SurfaceTool = SurfaceTool.new()
	kite_tool.begin(Mesh.PRIMITIVE_TRIANGLES)
	for vertex in [Vector3(0, 1.4, 0), Vector3(-.9, 0, 0), Vector3(0, -1.1, 0), Vector3(.9, 0, 0)]:
		kite_tool.add_vertex(vertex)
	for index in [0, 3, 1, 1, 3, 2]:
		kite_tool.add_index(index)
	kite_tool.generate_normals()
	_meshes.kite = kite_tool.commit()
	_material("road", Color("aeb3b1"), "res://assets/asphalt.png", .02, .91)
	_material("shoulder", Color("999b91"), "res://assets/asphalt.png", 0.0, .96)
	_material("ground", Color.WHITE)
	_material("forest", Color("d8dfc5"), "res://assets/forest.png")
	_material("rock", Color("c1c4b7"), "res://assets/rock.png")
	_material("sand", Color("eee2bf"), "res://assets/sand.png")
	_material("concrete", Color("c3bfae"), "res://assets/rock.png", 0.0, .94)
	_material("white", Color("eee9d9"))
	_material("yellow", Color("edb637"))
	_material("red", Color("b14536"))
	_material("silver", Color("aeb7b7"), "", .7, .35)
	_material("dark", Color("273638"), "", .2, .51)
	_material("glass", Color("5a808b"), "", .52, .18)
	_material("facade", Color.WHITE)
	_material("bark", Color("8b8170"))
	_material("foliage", Color.WHITE, "res://assets/forest.png", 0.0, .95)
	_material("crops", Color.WHITE)
	_material("distant_hill", Color("8b9d72"), "res://assets/forest.png")
	var tile_image: Image = Image.create(128, 128, true, Image.FORMAT_RGB8)
	for yy in 128:
		for xx in 128:
			var shade: float = .9 + .08 * sin(xx * .71 + yy * .43)
			if yy % 16 < 2 or (xx + (8 if (yy / 16) % 2 else 0)) % 16 < 2:
				shade = .65
			tile_image.set_pixel(xx, yy, Color("b98456") * shade)
	tile_image.generate_mipmaps()
	var roof: StandardMaterial3D = _material("roof", Color.WHITE)
	roof.albedo_texture = ImageTexture.create_from_image(tile_image)
	roof.cull_mode = BaseMaterial3D.CULL_DISABLED
	var palm: StandardMaterial3D = _material("palm", Color.WHITE, "res://assets/palm-tree.png", 0.0, .96)
	palm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	palm.alpha_scissor_threshold = .35
	palm.cull_mode = BaseMaterial3D.CULL_DISABLED
	palm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	if palm.albedo_texture != null:
		_materials.palm = _painted_shadow_receiver(palm.albedo_texture)
	if ResourceLoader.exists("res://assets/broadleaf-tree.png"):
		var tree_photo: StandardMaterial3D = _material("broadleaf", Color.WHITE, "res://assets/broadleaf-tree.png")
		tree_photo.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
		tree_photo.alpha_scissor_threshold = .35
		tree_photo.cull_mode = BaseMaterial3D.CULL_DISABLED
		tree_photo.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_materials.broadleaf = _painted_shadow_receiver(tree_photo.albedo_texture)
	var foam: StandardMaterial3D = _material("foam", Color("bde4db"))
	foam.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	foam.albedo_color.a = .65
	var water: ShaderMaterial = ShaderMaterial.new()
	var shader: Shader = load("res://godot/scripts/ocean.gdshader") as Shader
	water.shader = shader
	_materials.water = water

func _painted_shadow_receiver(paint: Texture2D) -> ShaderMaterial:
	# Preserve the authored image in deep shade while accepting real projected
	# shadows. The biased lighting normal treats a foliage cutout as a canopy,
	# and does not change the geometry or its alpha silhouette in the shadow pass.
	var shader := Shader.new()
	shader.code = """shader_type spatial;
render_mode cull_disabled, diffuse_lambert, specular_disabled;
uniform sampler2D paint : source_color, filter_linear_mipmap;
void vertex(){ NORMAL = normalize(NORMAL * 0.46 + vec3(0.0, 0.68, 0.0)); }
void fragment(){
 vec4 image = texture(paint, UV);
 ALBEDO = image.rgb * 0.62;
 EMISSION = image.rgb * 0.24;
 ROUGHNESS = 1.0;
 ALPHA = image.a;
 ALPHA_SCISSOR_THRESHOLD = 0.35;
}
"""
	var material := ShaderMaterial.new()
	material.shader = shader
	material.set_shader_parameter("paint", paint)
	return material

func _shop_pool(p: Dictionary) -> Array:
	var names: Array = REGIONAL_SHOPS.get(str(p._id), ["在地小吃", "寶島旅宿", "便利商店", "在地茶行"])
	for name in names:
		_local_sign(str(name))
	return names

func _local_sign(text: String) -> String:
	if not _sign_materials.has(text):
		var style: int = 0
		for i in text.length():
			style += text.unicode_at(i)
		_sign_materials[text] = _make_sign(text, style % 5)
	return text

func _roof_mesh() -> ArrayMesh:
	var vertices: PackedVector3Array = PackedVector3Array()
	var uvs: PackedVector2Array = PackedVector2Array()
	var indices: PackedInt32Array = PackedInt32Array()
	var n: int = 16
	for zz in n + 1:
		for xx in n + 1:
			var x: float = float(xx) / n * 2.0 - 1.0
			var z: float = float(zz) / n * 2.0 - 1.0
			var end: float = clampf((absf(z) - .63) / .37, 0.0, 1.0)
			var y: float = (1.0 - absf(x)) * (1.0 - end) * .9 + .08 + pow(absf(x * z), 4.0) * .27
			vertices.append(Vector3(x, y, z))
			uvs.append(Vector2(float(xx) / n * 3.0, float(zz) / n * 4.0))
			if xx < n and zz < n:
				var a: int = zz * (n + 1) + xx
				indices.append_array(PackedInt32Array([a, a + 1, a + n + 1, a + 1, a + n + 2, a + n + 1]))
	var st: SurfaceTool = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in vertices.size():
		st.set_uv(uvs[i])
		st.add_vertex(vertices[i])
	for index in indices:
		st.add_index(index)
	st.generate_normals()
	return st.commit()

func _make_sign(text: String, style: int = 0) -> StandardMaterial3D:
	# Font rasterization uses the project's CJK font when supplied. System fallback
	# keeps Chinese place and shop names readable in the editor and native builds.
	var font: Font = ThemeDB.fallback_font
	if ResourceLoader.exists("res://assets/fonts/NotoSansTC-Regular.ttf"):
		font = load("res://assets/fonts/NotoSansTC-Regular.ttf") as Font
	var bg: Array[Color] = [Color("174e65"), Color("a7382d"), Color("e6dcc0"), Color("267d7c"), Color("25485a"), Color("d8bb74")]
	# A SubViewport renders scalable CJK type once; the generated texture is shared
	# by all shopfront instances. It is not part of the per-frame 3D scene.
	var viewport: SubViewport = SubViewport.new()
	viewport.size = Vector2i(768, 144)
	viewport.transparent_bg = false
	viewport.render_target_update_mode = SubViewport.UPDATE_ONCE
	viewport.disable_3d = true
	var panel: ColorRect = ColorRect.new()
	panel.size = Vector2(768, 144)
	panel.color = bg[style % bg.size()]
	viewport.add_child(panel)
	var label: Label = Label.new()
	label.text = text
	label.position = Vector2(16, 6)
	label.size = Vector2(736, 132)
	label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	label.add_theme_font_override("font", font)
	label.add_theme_font_size_override("font_size", 64 if text.length() < 9 else 49)
	label.add_theme_color_override("font_color", Color("f4eed9") if style % 6 != 2 else Color("8a3427"))
	viewport.add_child(label)
	add_child(viewport)
	var mat: StandardMaterial3D = StandardMaterial3D.new()
	mat.albedo_texture = viewport.get_texture()
	mat.roughness = .7
	mat.emission_enabled = true
	mat.emission = Color(.09, .09, .09)
	mat.emission_texture = viewport.get_texture()
	return mat

func _batch_add(batches: Dictionary, geometry: String, material: String, position: Vector3, scale: Vector3, yaw: float = 0.0, color: Color = Color.WHITE, basis_override: Variant = null) -> void:
	var key: String = geometry + ":" + material
	if not batches.has(key):
		batches[key] = {"geometry": geometry, "material": material, "transforms": [], "colors": []}
	var basis: Basis = Basis(Vector3.UP, yaw) if basis_override == null else basis_override
	batches[key].transforms.append(Transform3D(basis * Basis.from_scale(scale), position))
	batches[key].colors.append(color)

func _put(batches: Dictionary, geometry: String, material: String, p: Dictionary, s: float, lateral: float, height: float, scale: Vector3, color: Color = Color.WHITE, extra_yaw: float = 0.0) -> void:
	var q: Dictionary = _sample(p, s)
	_batch_add(batches, geometry, material, _position(q, lateral, height), scale, -float(q.h) + extra_yaw, color)

func _beam(batches: Dictionary, material: String, a: Vector3, z: Vector3, width: float = .12, depth: float = -1.0) -> void:
	var direction: Vector3 = z - a
	if direction.length_squared() < .00001:
		return
	_batch_add(batches, "box", material, (a + z) * .5, Vector3(width, direction.length(), width if depth < 0.0 else depth), 0.0, Color.WHITE, Basis(Quaternion(Vector3.UP, direction.normalized())))

func _finish_batches(group: Node3D, batches: Dictionary) -> void:
	var total: int = 0
	for batch in batches.values():
		var mm: MultiMesh = MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = _meshes[batch.geometry]
		mm.instance_count = batch.transforms.size()
		for i in mm.instance_count:
			mm.set_instance_transform(i, batch.transforms[i])
			mm.set_instance_color(i, batch.colors[i])
		var instance: MultiMeshInstance3D = MultiMeshInstance3D.new()
		instance.multimesh = mm
		instance.material_override = _materials.get(batch.material, _sign_materials.get(batch.material))
		if batch.material in ["water", "foam"]:
			instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		group.add_child(instance)
		total += mm.instance_count
	group.set_meta("instances", total)

func _surface_builder(surfaces: Dictionary, material: String) -> Dictionary:
	if not surfaces.has(material):
		surfaces[material] = {"vertices": PackedVector3Array(), "uv": PackedVector2Array(), "colors": PackedColorArray(), "indices": PackedInt32Array()}
	return surfaces[material]

func _ground_height(kind: String, off: float, s: float, road_y: float, sea_level: float = 0.0) -> float:
	if kind in SEA_TYPES:
		var edge: float = 8.3 if kind == "harbor" else 2.0
		var end: float = _shore_start(kind)
		var t: float = clampf((off - edge) / (end - edge), 0.0, 1.0)
		return (sea_level - road_y) * t * t * (3.0 - 2.0 * t)
	var n: float = sin(s * .027 + off * .12) * sin(s * .043 - off * .08)
	match kind:
		"slope":
			return maxf(0.0, minf(130.0, pow(maxf(0.0, off - 2.0), .83) * 2.7) + n * minf(8.0, off * .1))
		"mountain":
			return maxf(0.0, minf(185.0, pow(maxf(0.0, off - 5.0), .89) * 2.0) + n * minf(9.0, off * .08))
		"hills":
			return 0.0 if off < 7.0 else maxf(0.0, (off - 7.0) * .3 + sin(off * .018) * 14.0 + n * minf(off * .045, 7.0))
		"gorge":
			return minf(165.0, maxf(0.0, off - 2.0) * 4.1) + n * minf(off * .2, 9.0)
		"cut":
			return minf(8.0, maxf(0.0, off - .7) * 4.0)
		"highland":
			return 0.0 if off < 3.0 else sin(off * .012) * 19.0 + n * minf(off * .05, 10.0)
		"tea", "daylily", "cabbage":
			return 0.0 if off < 4.0 else floorf((off - 4.0) / 4.0) * 1.35
		"lake", "river", "water", "fishpond", "milkfish":
			return -minf(4.5, off * .13)
	return -.03 if off < 5.0 else n * minf(off * .008, .6)

func _shore_start(kind: String) -> float:
	return 10.25 if kind == "harbor" else 70.0 if kind == "bay" else 55.0 if kind == "beach" else 5.0 if kind in ["river", "lake"] else 18.0

func _water_color(kind: String, distance: float) -> Color:
	var near_color: Color = Color("23748e") if kind == "harbor" else Color("3b8e83") if kind == "lake" else Color("43bdb7")
	var far_color: Color = Color("1b5b7e") if kind == "harbor" else Color("2f6975") if kind == "lake" else Color("086a9c")
	return near_color.lerp(far_color, clampf(distance / 150.0, 0.0, 1.0))

func _coastal_hills(b: Dictionary, p: Dictionary, s: float, sg: int) -> void:
	var q: Dictionary = _sample(p, s)
	var heading: float = float(q.h)
	for k in 4:
		var forward: float = 680.0 + k * 115.0
		var lateral: float = sg * (170.0 + k * 95.0)
		var sy: float = 45.0 + k * 15.0
		var pos: Vector3 = _position(q) + Vector3(sin(heading) * forward + cos(heading) * lateral, float(p._sea_level) + sy * .28 - float(q.y), -cos(heading) * forward + sin(heading) * lateral)
		_batch_add(b, "hill", "distant_hill", pos, Vector3(95.0 + k * 21.0, sy, 105.0 + k * 32.0), -heading)

func _ribbon(surfaces: Dictionary, material: String, p: Dictionary, a: float, z: float, offsets: Array, mode: String, sg: int = 1, kind: String = "grass", step: float = 8.0, line_ratio: float = 0.0) -> void:
	if z <= a:
		return
	var builder: Dictionary = _surface_builder(surfaces, material)
	var count: int = maxi(1, ceili((z - a) / step))
	var columns: int = offsets.size()
	var base: int = builder.vertices.size()
	for j in count + 1:
		var s: float = lerpf(a, z, float(j) / count)
		var q: Dictionary = _sample(p, s)
		for off in offsets:
			var lat: float = float(off)
			var height: float = .015
			var color: Color = Color.WHITE
			match mode:
				"paving":
					lat = float(q.left) if off < 0 else float(q.right)
				"road":
					lat = float(off) * float(q.hw)
					height = .027
				"line", "rail":
					lat = line_ratio * float(q.hw) + float(off)
					height = .1 if mode == "rail" else .046
				"ground":
					var distance: float = minf(float(off), _room(p, s, sg))
					lat = _edge(q, sg, distance)
					height = _ground_height(kind, distance, s, float(q.y), float(p._sea_level))
					color = _terrain_color(kind, distance, material)
					color *= .94 + .06 * sin(float(q.x) * .13 + s * .2)
				"water":
					lat = _edge(q, sg, minf(float(off), _room(p, s, sg)))
					height = float(p._sea_level) - float(q.y) if kind in SEA_TYPES else (float(p._basin) - float(q.y) if kind == "lake" else -4.5)
					color = _water_color(kind, float(off) - _shore_start(kind))
				"foam":
					lat = _edge(q, sg, float(off))
					height = float(p._sea_level) + .06 - float(q.y)
				"quay":
					lat = _edge(q, sg, float(off))
					height = float(p._sea_level) + 1.7 - float(q.y)
			builder.vertices.append(_position(q, lat, height))
			var tile: float = 5.0 if mode in ["road", "paving"] else 70.0 if material == "forest" else 17.0 if material == "rock" else 24.0
			builder.uv.append(Vector2(lat / tile, s / tile))
			builder.colors.append(color)
			if j < count and int(builder.vertices.size() - base - 1) % columns < columns - 1:
				var v: int = builder.vertices.size() - 1
				# Godot front faces wind clockwise, opposite to the Three.js mesh.
				builder.indices.append_array(PackedInt32Array([v, v + columns, v + 1, v + 1, v + columns, v + columns + 1]))

func _terrain_color(kind: String, distance: float, material: String) -> Color:
	if material != "ground":
		return Color("c6c3b3") if distance < 1.2 else Color("e5e6d4")
	if kind == "harbor":
		return Color("d0c9b7")
	if kind in ["city", "town", "plaza", "industrial"]:
		return Color("c3bdaa") if distance < 5.0 else Color("9f9c90")
	var palette: Dictionary = {"grass": "7f9258", "farm": "a4ad6c", "paddy": "91b454", "tea": "587c43", "daylily": "b8a449", "highland": "9b9f65", "cabbage": "9db67c", "orchard": "6a824b", "salt": "e2d4cf", "pineapple": "8d9c5c", "cane": "7e9b4f"}
	return Color(palette.get(kind, "79905b"))

func _finish_surfaces(group: Node3D, surfaces: Dictionary) -> void:
	for key in surfaces:
		var b: Dictionary = surfaces[key]
		if b.vertices.is_empty():
			continue
		var normals: PackedVector3Array = PackedVector3Array()
		normals.resize(b.vertices.size())
		for t in range(0, b.indices.size(), 3):
			var ia: int = b.indices[t]
			var ib: int = b.indices[t + 1]
			var ic: int = b.indices[t + 2]
			var n: Vector3 = (b.vertices[ic] - b.vertices[ia]).cross(b.vertices[ib] - b.vertices[ia]).normalized()
			normals[ia] += n
			normals[ib] += n
			normals[ic] += n
		for i in normals.size():
			normals[i] = normals[i].normalized()
		var arrays: Array = []
		arrays.resize(Mesh.ARRAY_MAX)
		arrays[Mesh.ARRAY_VERTEX] = b.vertices
		arrays[Mesh.ARRAY_NORMAL] = normals
		arrays[Mesh.ARRAY_TEX_UV] = b.uv
		arrays[Mesh.ARRAY_COLOR] = b.colors
		arrays[Mesh.ARRAY_INDEX] = b.indices
		var mesh: ArrayMesh = ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		var instance: MeshInstance3D = MeshInstance3D.new()
		instance.mesh = mesh
		instance.material_override = _materials[key]
		instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		group.add_child(instance)

func _road(surfaces: Dictionary, batches: Dictionary, p: Dictionary, a: float, z: float) -> void:
	_ribbon(surfaces, "shoulder", p, a, z, [-1.0, 1.0], "paving", 1, "grass", 4.0)
	_ribbon(surfaces, "road", p, a, z, [-1.0, 1.0], "road", 1, "grass", 4.0)
	_ribbon(surfaces, "white", p, a, z, [-.075, .075], "line", 1, "grass", 4.0, 1.0)
	_ribbon(surfaces, "yellow", p, a, z, [-.075, .075], "line", 1, "grass", 4.0, -1.0)
	var s: float = ceilf(a / 12.0) * 12.0
	while s < z:
		var q: Dictionary = _sample(p, s)
		var lanes: int = maxi(1, roundi(float(q.hw) * 2.0 / 3.5))
		for lane in range(1, lanes):
			_ribbon(surfaces, "white", p, s, minf(z, s + 4.0), [-.065, .065], "line", 1, "grass", 4.0, -1.0 + 2.0 * lane / lanes)
		s += 12.0
	s = a + 2.0
	while s < z:
		var sec: Dictionary = _section(p, s)
		var q: Dictionary = _sample(p, s)
		for sg in [-1, 1]:
			var kind: String = str(sec.get("R" if sg > 0 else "L", "grass"))
			if kind in URBAN_TYPES or kind == "harbor":
				_put(batches, "box", "red" if int(s / 4.0) % 3 == 0 else "white", p, s, _edge(q, sg, .1), .1, Vector3(.25, .2, 3.98))
		s += 4.0

func _side(surfaces: Dictionary, b: Dictionary, p: Dictionary, a: float, z: float, sec: Dictionary, sg: int, rng: RandomNumberGenerator) -> void:
	var kind: String = str(sec.get("R" if sg > 0 else "L", "grass"))
	var room: float = minf(_room(p, a + 1.0, sg), _room(p, (a + z) * .5, sg))
	if room < .4:
		return
	var widths: Array = [0.0, 1.1, 4.0, 12.0, 30.0, 65.0, 110.0, 165.0, 240.0]
	if kind in WATER_TYPES:
		widths = [0.0, .3, 8.3, 10.25] if kind == "harbor" else [0.0, 2.0, 12.0, 30.0, _shore_start(kind)] if kind in ["bay", "beach"] else [0.0, 2.0, 9.0, 18.0]
	for i in widths.size():
		widths[i] = minf(float(widths[i]), room)
	if sg < 0:
		widths.reverse()
	var material: String = "forest" if kind in ["slope", "mountain", "hills", "orchard"] else "rock" if kind in ["gorge", "cut", "riverbed", "shore", "pebble", "cliff"] else "sand" if kind in ["beach", "bay"] else "ground"
	_ribbon(surfaces, material, p, a, z, widths, "ground", sg, kind, 8.0 if kind in HILL_TYPES else 12.0)
	if kind in WATER_TYPES and room > 18.0:
		var start: float = _shore_start(kind)
		var water: Array = [start, minf(start + 28.0, room), minf(start + 110.0, room), minf(room, 320.0 if kind == "harbor" else 160.0 if kind == "river" else 850.0)]
		if sg < 0:
			water.reverse()
		_ribbon(surfaces, "water", p, a, z, water, "water", sg, kind, 18.0)
		if kind in SEA_TYPES and kind != "harbor":
			var foam: Array = [start + .5, start + 2.0]
			if sg < 0:
				foam.reverse()
			_ribbon(surfaces, "foam", p, a, z, foam, "foam", sg, kind, 8.0)
		if kind == "harbor" and room > 195.0:
			_ribbon(surfaces, "concrete", p, a, z, [132.0, 194.0] if sg > 0 else [194.0, 132.0], "quay", sg, kind)
	match kind:
		"city", "town":
			_streets(b, p, a, z, sg, kind, sec, rng)
		"industrial":
			_industry(b, p, a, z, sg, rng)
		"harbor":
			_harbor(b, p, a, z, sg, rng, sec)
		"plaza":
			for ss in range(ceili(a / 18.0) * 18, int(z), 18):
				var q: Dictionary = _sample(p, ss)
				_palm(b, p, ss, _edge(q, sg, 8.0), 1.1, rng)
				_person(b, p, ss + 7.0, _edge(q, sg, 6.0), rng)
		"cut":
			_cut(b, p, a, z, sg, sec)
		_:
			_nature(b, p, a, z, sg, kind, rng)
	if kind in ["bay", "beach", "shore", "cliff", "pebble"] and int(a / CHUNK) % 3 == 0:
		_coastal_hills(b, p, (a + z) * .5, sg)
	if kind in FIELD_TYPES:
		_fields(b, p, a, z, sg, kind, rng)
	if kind in SEA_TYPES or kind in ["lake", "river", "mountain", "gorge"] or sec.has("bridge") or "guardR" in sec.get("tags", []):
		_guard(b, p, a, z, sg, 8.0 if kind == "harbor" else .5, kind in ["harbor", "bay"])
	if kind in URBAN_TYPES or kind in ["harbor", "industrial"] or sec.has("bridge"):
		for ss in range(ceili(a / 42.0) * 42, int(z), 42):
			if _room(p, ss, sg) > 2.0:
				_lamp(b, p, ss, sg)
	var curvature: float = float(sec.get("k", 0.0))
	if absf(curvature) > .0035 and sg == (-1 if curvature > 0.0 else 1):
		for ss in range(ceili(a / 28.0) * 28, int(z), 28):
			_chevron(b, p, ss, sg)

func _palm(b: Dictionary, p: Dictionary, s: float, lat: float, size: float, rng: RandomNumberGenerator, base: float = 0.0) -> void:
	var height: float = (10.7 + rng.randf() * 4.5) * size
	if base < .6:
		_solid(p, s, lat, .3 * size, .33 * size)
	if _materials.palm is ShaderMaterial:
		_put(b, "photo", "palm", p, s, lat, base + height * .5 - .04, Vector3(height * 2.0 / 3.0, height, 1.0))
	else:
		_put(b, "trunk", "bark", p, s, lat, base + height * .4, Vector3(size, height * .8, size))
		for k in 8:
			_put(b, "ball", "foliage", p, s + sin(k * TAU / 8.0) * 2.0, lat + cos(k * TAU / 8.0) * 2.0, base + height * .8, Vector3(2.2, .3, .9) * size, Color("5c7f3e"), k * TAU / 8.0)

func _tree(b: Dictionary, p: Dictionary, s: float, lat: float, size: float, base: float = 0.0, pine: bool = false) -> void:
	var height: float = (9.0 if pine else 5.0) * size
	if base < .8:
		_solid(p, s, lat, .22 * size, .22 * size)
	if _materials.has("broadleaf") and not pine:
		var full: float = 8.2 * size
		_put(b, "photo", "broadleaf", p, s, lat, base + full * .5 - .04, Vector3(full * 2.0 / 3.0, full, 1.0))
		return
	_put(b, "pole", "bark", p, s, lat, base + height * .4, Vector3(.17 * size, height * .8, .17 * size))
	if pine:
		for k in 4:
			_put(b, "cone", "foliage", p, s, lat, base + height * (.42 + k * .15), Vector3((2.6 - k * .42) * size, 3.3 * size, (2.6 - k * .42) * size), Color("5e7b48"))
	else:
		for k in (2 if _low else 4):
			_put(b, "ball", "foliage", p, s + sin(k * 2.4) * size, lat + cos(k * 2.4) * size, base + height * (.9 + (k % 2) * .11), Vector3(2.3 + k * .18, 1.9 + (k % 2) * .6, 2.1) * size, Color("6b8752"))

func _bush(b: Dictionary, p: Dictionary, s: float, lat: float, size: float = 1.0, base: float = 0.0) -> void:
	_put(b, "ball", "foliage", p, s, lat, base + .48 * size, Vector3(.85, .5, .9) * size, Color("849869"))

func _person(b: Dictionary, p: Dictionary, s: float, lat: float, rng: RandomNumberGenerator, base: float = 0.0) -> void:
	_put(b, "ball", "facade", p, s, lat, base + 1.52, Vector3(.13, .18, .13), Color("c99f7c"))
	var shirts: Array[Color] = [Color("f3ebd8"), Color("49708b"), Color("b25a41"), Color("81927c")]
	_put(b, "box", "facade", p, s, lat, base + 1.04, Vector3(.35, .6, .22), shirts[rng.randi_range(0, 3)])
	for sg in [-1, 1]:
		_put(b, "box", "dark", p, s + sg * .11, lat, base + .36, Vector3(.13, .74, .13))

func _building(b: Dictionary, p: Dictionary, s: float, sg: int, off: float, width: float, depth: float, height: float, rng: RandomNumberGenerator, beach: bool = false) -> void:
	if _room(p, s, sg) < off + depth + 1.0:
		return
	var q: Dictionary = _sample(p, s)
	var lat: float = _edge(q, sg, off + depth * .5)
	var front: float = _edge(q, sg, off - .06)
	_solid(p, s, lat, depth * .5, width * .5, "wall")
	var palette: Array[Color] = [Color("ded4bd"), Color("d7d7c8"), Color("d1bfa6"), Color("c1c7bd"), Color("e7d5bf")]
	var color: Color = palette[rng.randi_range(0, palette.size() - 1)]
	_put(b, "box", "facade", p, s, lat, height * .5 + .15, Vector3(depth, height, width), color)
	_put(b, "box", "concrete", p, s, lat, height + .2, Vector3(depth + .3, .3, width + .3))
	var floors: int = int((height - 3.0) / 2.9)
	var cols: int = maxi(1, int(width / 2.8))
	for f in floors:
		for col in cols:
			var ss: float = s - width * .5 + (col + .5) * width / cols
			var yy: float = 4.7 + f * 2.9
			_put(b, "box", "dark", p, ss, front, yy, Vector3(.18, 1.82, width / cols * .7))
			_put(b, "box", "glass", p, ss, front - sg * .11, yy + .035, Vector3(.07, 1.62, width / cols * .62))
			_put(b, "box", "white", p, ss, front - sg * .2, yy - .92, Vector3(.45, .13, width / cols * .78))
			if f % 2 == 0 and col % 2 == 0:
				_put(b, "box", "concrete", p, ss, front - sg * .47, yy - .98, Vector3(1.2, .15, width / cols * .9))
				for dh in [-.17, -.65]:
					_put(b, "box", "dark", p, ss, front - sg * 1.02, yy + dh, Vector3(.045, .045, width / cols * .8))
				for post in (3 if _low else 6):
					_put(b, "box", "dark", p, ss - width / cols * .4 + width / cols * .8 * post / (2.0 if _low else 5.0), front - sg * 1.02, yy - .55, Vector3(.035, .8, .035))
	var names: Array = _shop_pool(p)
	var name: String = str(names[rng.randi_range(0, names.size() - 1)])
	_put(b, "box", name, p, s, front - sg * .12, 3.1, Vector3(.16, .85, width * .88))
	_put(b, "box", "glass", p, s, front - sg * .03, 1.42, Vector3(.11, 2.5, width * .9))
	for frame in 4:
		_put(b, "box", "silver", p, s - width * .4 + frame * width * .8 / 3.0, front - sg * .11, 1.42, Vector3(.12, 2.5, .055))
	for j in 3:
		var ss: float = s - width * .5 + .25 + j * (width - .5) * .5
		_put(b, "box", "facade", p, ss, front - sg * 1.2, 1.5, Vector3(.35, 3.0, .35), color)
		_solid(p, ss, front - sg * 1.2, .175, .175)
	_put(b, "box", "concrete", p, s, front - sg * .65, 3.0, Vector3(1.7, .23, width + .2))
	if beach or rng.randf() < .55:
		var shades: Array[Color] = [Color("b9593e"), Color("5c8e73"), Color("d4ac55"), Color("4b7995")]
		for j in ceili(width):
			_put(b, "box", "facade", p, s - width * .5 + j + .5, front - sg * 1.48, 2.8, Vector3(1.35, .14, .98), Color("e9e0c7") if j % 2 else shades[int(s) % 4])
	if rng.randf() < .55:
		_put(b, "box", name, p, s + width * .35, front - sg * .9, 5.8, Vector3(.19, 3.0, 1.05))
	if rng.randf() < .65:
		_put(b, "pole", "silver", p, s + width * .28, lat, height + 1.0, Vector3(.7, 1.65, .7))

func _streets(b: Dictionary, p: Dictionary, a: float, z: float, sg: int, kind: String, sec: Dictionary, rng: RandomNumberGenerator) -> void:
	var beach: bool = "beachshops" in sec.get("tags", []) or "nightmarket" in sec.get("tags", [])
	for s in range(floori(a / 14.0) * 14 + 7, int(z), 14):
		if s < a:
			continue
		var h: float = 7.2 + rng.randf() * 6.0 if beach else (10.0 + rng.randf() * 9.0 if kind == "city" else 7.0 + rng.randf() * 7.0)
		_building(b, p, s, sg, 5.8, 12.5, 8.0 + rng.randf() * 5.0, h, rng, beach)
	for s in range(ceili(a / 19.0) * 19, int(z), 19):
		if _room(p, s, sg) < 5.0:
			continue
		var q: Dictionary = _sample(p, s)
		_palm(b, p, s, _edge(q, sg, 3.3), .9 + rng.randf() * .17, rng)
		_put(b, "box", "concrete", p, s, _edge(q, sg, 3.3), .28, Vector3(1.5, .55, 1.5))
		_bush(b, p, s, _edge(q, sg, 3.3), .8, .5)
		if s % 3 == 0:
			_person(b, p, s + 5.0, _edge(q, sg, 2.0), rng)
	for s in range(ceili(a / 39.0) * 39, int(z), 39):
		var off: float = 27.0 + rng.randf() * 24.0
		if _room(p, s, sg) < off + 15.0:
			continue
		var q: Dictionary = _sample(p, s)
		var lat: float = _edge(q, sg, off)
		var h: float = 22.0 + rng.randf() * 47.0 if kind == "city" else 10.0 + rng.randf() * 14.0
		_put(b, "box", "facade", p, s, lat, h * .5, Vector3(14.0, h, 19.0), Color("bfc7bd"))
		for f in range(4, int(h), 3):
			_put(b, "box", "glass", p, s, lat - sg * 7.06, f, Vector3(.05, 1.4, 16.0))

func _guard(b: Dictionary, p: Dictionary, a: float, z: float, sg: int, off: float, white: bool = false) -> void:
	var material: String = "white" if white else "silver"
	for s in range(ceili(a / 4.0) * 4, int(z), 4):
		if _room(p, s, sg) < off + .7:
			continue
		var q: Dictionary = _sample(p, s)
		var lat: float = _edge(q, sg, off)
		_solid(p, s, lat, .14 if white else .17, 2.0, "wall")
		_put(b, "box", material, p, s, lat, .53, Vector3(.13, 1.06, .13))
		if white:
			_put(b, "ball", "yellow", p, s, lat, 1.1, Vector3(.105, .105, .105))
		for h in [.45, .92] if white else [.74]:
			var ss0: float = maxf(a, s - 2.0)
			var ss1: float = minf(z, s + 2.0)
			var qa: Dictionary = _sample(p, ss0)
			var qz: Dictionary = _sample(p, ss1)
			_beam(b, material, _position(qa, _edge(qa, sg, off), h), _position(qz, _edge(qz, sg, off), h), .1 if white else .18, .075)

func _lamp(b: Dictionary, p: Dictionary, s: float, sg: int) -> void:
	var q: Dictionary = _sample(p, s)
	var lat: float = _edge(q, sg, .8)
	_solid(p, s, lat, .1, .1)
	_beam(b, "silver", _position(q, lat), _position(q, lat, 9.5), .14)
	_beam(b, "silver", _position(q, lat, 9.5), _position(q, lat - sg * 2.5, 10.15), .11)
	_put(b, "box", "silver", p, s, lat - sg * 2.7, 10.1, Vector3(.9, .16, .35))
	_put(b, "box", "white", p, s, lat - sg * 2.7, 9.99, Vector3(.65, .035, .25))

func _chevron(b: Dictionary, p: Dictionary, s: float, sg: int) -> void:
	var q: Dictionary = _sample(p, s)
	var lat: float = _edge(q, sg, 1.2)
	_put(b, "pole", "silver", p, s, lat, .8, Vector3(.05, 1.6, .05))
	_put(b, "box", "yellow", p, s, lat, 1.75, Vector3(.8, .85, .08))
	var base: Vector3 = _position(q, lat, 1.75)
	var right: Vector3 = Vector3(cos(float(q.h)), 0.0, sin(float(q.h)))
	var front: Vector3 = Vector3(sin(float(q.h)), 0.0, -cos(float(q.h)))
	_beam(b, "dark", base - right * .18 + Vector3.UP * .23 - front * .06, base + right * .15 - front * .06, .1)
	_beam(b, "dark", base + right * .15 - front * .06, base - right * .18 - Vector3.UP * .23 - front * .06, .1)

func _nature(b: Dictionary, p: Dictionary, a: float, z: float, sg: int, kind: String, rng: RandomNumberGenerator) -> void:
	var mountain: bool = kind in HILL_TYPES
	var pine: bool = kind == "highland" or str(p.get("pano", "")) == "cingjing"
	for s in range(int(a) + 3, int(z), 11 if _low else 7):
		var room: float = _room(p, s, sg)
		if room < 3.0:
			continue
		var q: Dictionary = _sample(p, s)
		if kind in SEA_TYPES:
			if kind not in ["cliff", "pebble"] and rng.randf() < .4:
				_palm(b, p, s, _edge(q, sg, 2.1), .8 + rng.randf() * .25, rng)
			_bush(b, p, s, _edge(q, sg, 1.3), .5 + rng.randf() * .6)
			if kind in ["bay", "beach"] and room > 25.0:
				var off: float = 10.0 + rng.randf() * 13.0
				var h: float = _ground_height(kind, off, s, float(q.y), float(p._sea_level))
				if rng.randf() < .45:
					_umbrella(b, p, s, _edge(q, sg, off), h, rng)
				if rng.randf() < .5:
					_person(b, p, s + 1.0, _edge(q, sg, off), rng, h)
			elif kind not in ["bay", "beach"] and room > 20.0:
				var off: float = 6.0 + rng.randf() * 12.0
				var h: float = _ground_height(kind, off, s, float(q.y), float(p._sea_level))
				var size: float = .8 + rng.randf() * 2.0
				_put(b, "ball", "concrete", p, s, _edge(q, sg, off), h + size * .4, Vector3(size, size * .7, size * .8), Color("a69f8d"))
		elif kind == "gorge" and room > 9.0:
			_put(b, "ball", "concrete", p, s, _edge(q, sg, 7.0), 20.0, Vector3(5.0, 9.0, 7.0), Color("b7c0b8"))
		elif kind not in WATER_TYPES and kind not in ["riverbed", "salt"]:
			if kind in ["grass", "orchard", "hills"]:
				if rng.randf() < .45:
					_palm(b, p, s, _edge(q, sg, 2.8), .8 + rng.randf() * .3, rng)
				else:
					_tree(b, p, s, _edge(q, sg, 4.5), .7 + rng.randf() * .5, _ground_height(kind, 4.5, s, float(q.y)), pine)
			_bush(b, p, s, _edge(q, sg, 1.5), .8 + rng.randf() * .4)
		if mountain or kind in ["orchard", "grass"]:
			for j in (3 if _low else 5):
				var off: float = 9.0 + j * 15.0 + rng.randf() * 13.0
				if room < off + 4.0:
					continue
				_tree(b, p, s, _edge(q, sg, off), (1.1 if mountain else .9) + rng.randf() * .6, _ground_height(kind, off, s, float(q.y)), pine)
	if kind in ["slope", "mountain"]:
		for s in range(int(a) + 3, int(z), 6):
			var q: Dictionary = _sample(p, s)
			_put(b, "box", "concrete", p, s, _edge(q, sg, 1.9), 1.1, Vector3(.6, 2.2, 6.0), Color("a5a894"))
			_solid(p, s, _edge(q, sg, 1.9), .3, 3.0, "wall")

func _umbrella(b: Dictionary, p: Dictionary, s: float, lat: float, base: float, rng: RandomNumberGenerator) -> void:
	_put(b, "pole", "white", p, s, lat, base + 1.15, Vector3(.035, 2.3, .035))
	var colors: Array[Color] = [Color("dc7454"), Color("5ba7c7"), Color("e4cb67"), Color("ded6ba")]
	_put(b, "cone", "facade", p, s, lat, base + 2.4, Vector3(1.5, .45, 1.5), colors[rng.randi_range(0, 3)])
	_put(b, "box", "white", p, s + .7, lat, base + .15, Vector3(1.6, .1, .6))

func _fields(b: Dictionary, p: Dictionary, a: float, z: float, sg: int, kind: String, rng: RandomNumberGenerator) -> void:
	for s in range(ceili(a / 18.0) * 18, int(z), 18):
		var q: Dictionary = _sample(p, s)
		for off in range(8, 88, 9):
			if _room(p, s, sg) < off + 2.0:
				continue
			var h: float = _ground_height(kind, off, s, float(q.y))
			if kind in ["fishpond", "milkfish", "salt"]:
				_put(b, "box", "white" if kind == "salt" else "water", p, s, _edge(q, sg, off + 3.0), -.02, Vector3(7.8, .035, 15.0), Color("ead3d4") if kind == "salt" else Color("83a78d"))
			else:
				var color: Color = Color("dfac46") if kind == "daylily" else Color("b5cd93") if kind == "cabbage" else Color("6f9852")
				_put(b, "box", "crops", p, s, _edge(q, sg, off), h + .16, Vector3(2.4 if kind == "tea" else 1.3, 1.8 if kind == "cane" else .35, 15.5), color)
	if int(a / CHUNK) % 2 == 0:
		_building(b, p, (a + z) * .5, sg, 25.0, 10.0, 8.0, 5.8, rng)

func _harbor(b: Dictionary, p: Dictionary, a: float, z: float, sg: int, rng: RandomNumberGenerator, sec: Dictionary) -> void:
	for s in range(ceili(a / 22.0) * 22, int(z), 22):
		if _room(p, s, sg) < 9.0:
			continue
		var q: Dictionary = _sample(p, s)
		_palm(b, p, s, _edge(q, sg, 6.2), .95, rng)
		_put(b, "box", "concrete", p, s + 6.0, _edge(q, sg, 3.3), .4, Vector3(1.2, .8, 1.7))
		_bush(b, p, s + 6.0, _edge(q, sg, 3.3), 1.1, .8)
		if rng.randf() < .5:
			_person(b, p, s + 9.0, _edge(q, sg, 4.0), rng)
	var container_port: bool = str(p.get("stageId", p._id)) == "s1" or "cranes" in sec.get("tags", []) or "ships" in sec.get("tags", []) or "containers" in sec.get("tags", [])
	if not container_port:
		return
	for s in range(ceili(a / 150.0) * 150 + 45, int(z), 150):
		if s < a or _room(p, s, sg) < 195.0:
			continue
		var q: Dictionary = _sample(p, s)
		var lat: float = _edge(q, sg, 147.0)
		var base: float = float(p._sea_level) + 1.7 - float(q.y)
		var top: float = 42.0 + base
		for ds in [-11.0, 11.0]:
			for dx in [-9.0, 9.0]:
				_beam(b, "red", _position(_sample(p, s + ds), lat + dx, base), _position(_sample(p, s + ds), lat + dx * .55, top - 6.0), .9)
		_beam(b, "red", _position(q, lat + sg * 18.0, top), _position(q, lat - sg * 49.0, top + 6.0), .9, 1.1)
		_beam(b, "red", _position(q, lat, top - 6.0), _position(q, lat, top + 14.0), 1.1)
		_beam(b, "silver", _position(q, lat, top + 14.0), _position(q, lat - sg * 49.0, top + 6.0), .1)
		_beam(b, "silver", _position(q, lat, top + 14.0), _position(q, lat + sg * 18.0, top), .1)
		_put(b, "box", "white", p, s, lat, top - 6.0, Vector3(5.0, 3.5, 5.0))
		_ship(b, p, s + 31.0, _edge(q, sg, 93.0), rng, sg)

func _ship(b: Dictionary, p: Dictionary, s: float, lat: float, rng: RandomNumberGenerator, sg: int) -> void:
	var base: float = float(p._sea_level) - float(_sample(p, s).y)
	_put(b, "box", "dark", p, s, lat, base + 1.1, Vector3(17.0, 5.0, 83.0))
	_put(b, "box", "red", p, s, lat, base - .7, Vector3(17.1, 1.2, 83.0))
	var colors: Array[Color] = [Color("b85b48"), Color("b6a778"), Color("4c7b86"), Color("a5afa0")]
	for row in 3:
		for k in 6:
			_put(b, "box", "facade", p, s - 30.0 + k * 10.0, lat + (row - 1) * 4.2, base + 5.4 + (k % 2) * 2.3, Vector3(3.9, 4.4, 9.5), colors[rng.randi_range(0, 3)])
	_put(b, "box", "white", p, s + 33.0, lat, base + 8.4, Vector3(11.0, 13.0, 10.0))
	_put(b, "box", "glass", p, s + 33.0, lat - sg * 5.6, base + 12.4, Vector3(.12, 1.6, 9.0))

func _industry(b: Dictionary, p: Dictionary, a: float, z: float, sg: int, rng: RandomNumberGenerator) -> void:
	for s in range(ceili(a / 30.0) * 30 + 12, int(z), 30):
		if s < a or _room(p, s, sg) < 35.0:
			continue
		var q: Dictionary = _sample(p, s)
		_put(b, "box", "concrete", p, s, _edge(q, sg, 23.0), 4.0, Vector3(24.0, 8.0, 25.0))
		for k in 3:
			_put(b, "box", "facade", p, s + (k - 1) * 7.2, _edge(q, sg, 8.0), 1.4, Vector3(2.4, 2.8, 6.2), Color("a2684c") if k % 2 else Color("6c8a88"))
		if rng.randf() < .25:
			_put(b, "pole", "concrete", p, s, _edge(q, sg, 31.0), 17.0, Vector3(1.25, 34.0, 1.25))
			_put(b, "pole", "red", p, s, _edge(q, sg, 31.0), 28.0, Vector3(1.27, 3.0, 1.27))

func _cut(b: Dictionary, p: Dictionary, a: float, z: float, sg: int, sec: Dictionary) -> void:
	for s in range(int(a) + 3, int(z), 6):
		var q: Dictionary = _sample(p, s)
		var lat: float = _edge(q, sg, .7)
		_put(b, "box", "concrete", p, s, lat, 3.2, Vector3(.8, 6.4, 6.05))
		_solid(p, s, lat, .4, 3.025, "wall")
		if "tunnel" in sec.get("tags", []) or "deck" in sec.get("tags", []):
			_put(b, "box", "concrete", p, s, 0.0, 6.7, Vector3(float(q.right) - float(q.left) + 1.7, .7, 6.05))
		if s % 18 < 6:
			_put(b, "box", "white", p, s, lat - sg * .48, 4.2, Vector3(.12, .2, 1.1))

func _landmarks(b: Dictionary, p: Dictionary, a: float, z: float, rng: RandomNumberGenerator) -> void:
	var sections: Array = p.get("sections", p.get("secs", []))
	for sec in sections:
		var start: float = float(sec.get("start", 0.0))
		var end: float = float(sec.get("end", p._length))
		var s: float = start + minf(100.0, (end - start) * .45)
		if s < a or s >= z:
			continue
		var tags: Array = sec.get("tags", [])
		if "start" in tags or "checkpoint" in tags or "goal" in tags:
			_arch(b, p, start + (48.0 if "start" in tags else 140.0 if "goal" in tags else 60.0), "FORMOSA RUN" if "start" in tags else "FINISH" if "goal" in tags else "CHECKPOINT")
		if bool(sec.get("diverge", false)):
			continue
		if "forksign" in tags and p.has("sign"):
			_fork_sign(b, p, start + 65.0, p.sign)
		if "lightrail" in tags or "tram" in tags:
			_elevated_rail(b, p, (start + end) * .5)
		if str(p._id) == "s1" and "tower85sign" in tags:
			_tower(b, p, minf(float(p._length), s + 650.0), -150.0, false)
		if str(p._id) == "s5a" and "taipei101" in tags:
			_tower(b, p, s + 100.0, -110.0, true)
		if (str(p._id) == "s5h" and "lighthouse" in tags) or (str(p._id) == "s5b" and "fuguijiao" in tags):
			_lighthouse(b, p, s, 45.0, "fuguijiao" in tags)
		for tag in ["temple", "templegate", "bigtemple", "wenwu", "fuan", "zhenlan", "changchun", "pagodas", "parade_beigang"]:
			if tag in tags:
				_temple(b, p, s, -36.0)
				break
		if "mangostall" in tags or "mango" in tags or "fruit" in tags or "betelstand" in tags or "coffee" in tags:
			var text: String = "海景咖啡"
			if "betelstand" in tags:
				text = "檳榔攤"
			elif "mangostall" in tags or "mango" in tags or "fruit" in tags:
				text = "枋山芒果" if str(p._id) == "s4h" else "在地鮮果"
				if str(p._id) != "s4h":
					for name in _shop_pool(p):
						if "鮮果" in str(name):
							text = str(name)
			elif str(p._id) == "s5c":
				text = "湖畔咖啡"
			elif str(p._id) == "s5n":
				text = "九份茶館"
			elif str(p._id) in ["s3m", "s3sm", "s4b", "s4g", "s5d", "s5m"]:
				text = "山城咖啡"
			_stall(b, p, s + 12.0, -1, text)
		if "windmills" in tags or "windmill" in tags:
			for k in 3:
				_windmill(b, p, s + k * 44.0, _edge(_sample(p, s), 1, 75.0 + k * 25.0))
		if "sailrock" in tags or "frogrock" in tags or "queenhead" in tags or "catrock" in tags:
			var lat: float = _edge(_sample(p, s), 1, 55.0)
			_put(b, "ball", "concrete", p, s + 30.0, lat, 8.0 - float(_sample(p, s).y), Vector3(12.0, 16.0, 9.0), Color("c7c6b3"))
		if sec.has("bridge"):
			_bridge(b, p, start, end, str(sec.bridge))
		_cultural_scenery(b, p, s, tags, rng)
		if "chalet" in tags:
			_building(b, p, s, -1, 18.0, 13.0, 9.0, 8.0, rng)

func _arch(b: Dictionary, p: Dictionary, s: float, text: String) -> void:
	var q: Dictionary = _sample(p, s)
	var left: float = float(q.left) - .2
	var right: float = float(q.right) + .2
	for lat in [left, right]:
		_put(b, "box", "white", p, s, lat, 3.6, Vector3(.28, 7.2, .28))
		_solid(p, s, lat, .14, .14)
	if not _sign_materials.has(text):
		_sign_materials[text] = _make_sign(text)
	_put(b, "box", text, p, s, (left + right) * .5, 7.15, Vector3(right - left + .5, 1.35, .22))

func _fork_sign(b: Dictionary, p: Dictionary, s: float, directions: Dictionary) -> void:
	var q: Dictionary = _sample(p, s)
	var half: float = maxf(9.0, float(q.hw) + 1.5)
	for sg in [-1, 1]:
		_put(b, "pole", "silver", p, s, sg * half, 4.2, Vector3(.14, 8.4, .14))
	_put(b, "box", "silver", p, s, 0.0, 8.1, Vector3(half * 2.0, .22, .22))
	for sg in [-1, 1]:
		var lines: Array = directions.get("L" if sg < 0 else "R", ["寶島", "", ""])
		var text: String = ("↖ " if sg < 0 else "↗ ") + str(lines[0]) + "\n" + str(lines[1]) + " " + str(lines[2])
		if not _sign_materials.has(text):
			_sign_materials[text] = _make_sign(text, 3)
		_put(b, "box", text, p, s, sg * half * .49, 7.1, Vector3(half * .92, 2.3, .14))

func _tower(b: Dictionary, p: Dictionary, s: float, lat: float, taipei: bool) -> void:
	if not taipei:
		for sg in [-1, 1]:
			_put(b, "box", "glass", p, s, lat + sg * 21.0, 79.5, Vector3(30.8, 159.0, 39.2))
		_put(b, "box", "glass", p, s, lat, 168.0, Vector3(28.0, 159.0, 33.6))
		_put(b, "box", "glass", p, s, lat, 256.5, Vector3(18.2, 27.0, 23.8))
		_put(b, "pole", "silver", p, s, lat, 280.5, Vector3(.42, 24.0, .42))
		for h in range(6, 256, 5):
			if h < 89:
				for sg in [-1, 1]:
					_put(b, "box", "silver", p, s + 19.75, lat + sg * 21.0, h, Vector3(30.9, .3, .14))
			else:
				_put(b, "box", "silver", p, s + (19.75 if h < 159 else 16.9), lat, h, Vector3(71.4 if h < 159 else 28.3, .3, .14))
	else:
		_put(b, "box", "concrete", p, s, lat, 10.0, Vector3(40.0, 20.0, 40.0))
		for k in 8:
			_put(b, "box", "glass", p, s, lat, 29.0 + k * 18.0, Vector3(25.0 - k * .6, 17.0, 25.0 - k * .6))
			_put(b, "box", "silver", p, s, lat, 37.0 + k * 18.0, Vector3(27.0 - k * .6, 1.0, 27.0 - k * .6))
		_put(b, "pole", "silver", p, s, lat, 187.0, Vector3(.55, 35.0, .55))

func _lighthouse(b: Dictionary, p: Dictionary, s: float, lat: float, striped: bool) -> void:
	_put(b, "pole", "white", p, s, lat, 8.5, Vector3(3.3, 17.0, 3.3))
	if striped:
		for h in range(3, 15, 4):
			_put(b, "pole", "dark", p, s, lat, h, Vector3(3.32, 2.0, 3.32))
	_put(b, "pole", "dark", p, s, lat, 17.8, Vector3(3.7, .5, 3.7))
	_put(b, "pole", "glass", p, s, lat, 19.1, Vector3(2.1, 2.4, 2.1))
	_put(b, "cone", "dark", p, s, lat, 21.1, Vector3(3.0, 1.9, 3.0))

func _temple(b: Dictionary, p: Dictionary, s: float, lat: float) -> void:
	_put(b, "box", "red", p, s, lat, 3.2, Vector3(20.0, 6.4, 24.0))
	_put(b, "box", "red", p, s, lat, 8.7, Vector3(14.0, 3.2, 16.0))
	for k in 2:
		_put(b, "roof", "roof", p, s, lat, 6.6 + k * 3.8, Vector3(12.5 - k * 3.0, 3.4, 14.5 - k * 3.0))
	for ds in [-9.0, -3.0, 3.0, 9.0]:
		_put(b, "pole", "red", p, s + ds, lat + 10.5, 2.9, Vector3(.35, 5.8, .35))
		_put(b, "ball", "red", p, s + ds, lat + 11.0, 4.8, Vector3(.55, .7, .55), Color("da623b"))
	if str(p._id) == "s4f":
		_put(b, "box", _local_sign("北港朝天宮"), p, s, lat + 10.04, 5.3, Vector3(.12, 1.1, 7.2))

func _stall(b: Dictionary, p: Dictionary, s: float, sg: int, sign_text: String) -> void:
	if _room(p, s, sg) < 7.0:
		return
	var lat: float = _edge(_sample(p, s), sg, 4.6)
	_solid(p, s, lat, 1.5, 2.5, "wall")
	_put(b, "box", "white", p, s, lat, .8, Vector3(3.0, 1.6, 5.0))
	_put(b, "box", "yellow", p, s, lat, 2.8, Vector3(4.6, .2, 6.0))
	_put(b, "box", _local_sign(sign_text), p, s, lat - sg * 1.5, 3.4, Vector3(.1, .8, 5.5))
	for ds in [-2.5, 2.5]:
		_put(b, "pole", "white", p, s + ds, lat, 1.6, Vector3(.06, 3.2, .06))
	for k in 8:
		_put(b, "ball", "yellow", p, s - 1.8 + k * .5, lat - sg * 1.5, 1.72, Vector3(.2, .15, .2))

func _windmill(b: Dictionary, p: Dictionary, s: float, lat: float) -> void:
	var q: Dictionary = _sample(p, s)
	_put(b, "pole", "white", p, s, lat, 22.0, Vector3(.65, 44.0, .65))
	_put(b, "box", "white", p, s, lat, 44.5, Vector3(2.2, 2.3, 3.5))
	for k in 3:
		var angle: float = k * TAU / 3.0 + .2
		_beam(b, "white", _position(q, lat, 44.5), _position(q, lat + sin(angle) * 17.0, 44.5 + cos(angle) * 17.0), .7, .18)

func _bridge(b: Dictionary, p: Dictionary, a: float, z: float, kind: String) -> void:
	var s: float = (a + z) * .5
	var q: Dictionary = _sample(p, s)
	var half: float = float(q.hw) + 3.0
	for sg in [-1, 1]:
		for ss in range(int(a) + 8, int(z), 12):
			_put(b, "box", "concrete", p, ss, sg * half, -.5, Vector3(.5, 1.0, 12.1))
		if kind != "girder":
			_put(b, "box", "white", p, s, sg * half, 19.0, Vector3(1.0, 38.0, 1.0))
			for ds in range(-80, 81, 16):
				_beam(b, "silver", _position(q, sg * half, 37.0), _position(_sample(p, s + ds), sg * half, 1.2), .08)
	if kind != "girder":
		_beam(b, "white", _position(q, -half, 32.0), _position(q, half, 32.0), .7)

func _elevated_rail(b: Dictionary, p: Dictionary, s: float) -> void:
	var q: Dictionary = _sample(p, s)
	var half: float = maxf(-float(q.left), float(q.right)) + 3.6
	_put(b, "box", "concrete", p, s, 0.0, 5.08, Vector3(96.0, .48, 4.8))
	for ds in [-2.18, 2.18]:
		_put(b, "box", "concrete", p, s + ds, 0.0, 5.72, Vector3(96.0, .8, .17))
	for ds in [-.72, .72]:
		_put(b, "box", "silver", p, s + ds, 0.0, 5.39, Vector3(96.0, .1, .07))
	for lat in [-half, half]:
		_put(b, "pole", "concrete", p, s, lat, 2.5, Vector3(.5, 5.0, .5))
		_put(b, "box", "concrete", p, s, lat, 4.7, Vector3(2.4, .6, 4.3))
		_solid(p, s, lat, .5, .5, "wall")

func _cultural_scenery(b: Dictionary, p: Dictionary, s: float, tags: Array, rng: RandomNumberGenerator) -> void:
	var q: Dictionary = _sample(p, s)
	if str(p._id) in ["s4a", "s5k"] and "boardwalk" in tags:
		_boardwalk(b, p, s)
	if str(p._id) == "s5o" and "sanxiantai" in tags:
		_eight_arch_bridge(b, p, s)
	if str(p._id) in ["s4f", "s4g"] and "redbridge" in tags:
		_red_bridge(b, p, s, str(p._id) == "s4g")
	# Shitiping is a low tuff sea terrace, using this piece's sea level.
	if str(p._id) == "s5p" and "shitipingrocks" in tags:
		for k in 5:
			var ss: float = s + (k % 2) * 8.0
			var sq: Dictionary = _sample(p, ss)
			var lat: float = _edge(sq, 1, 19.0 + k * 5.0)
			var top: float = float(p._sea_level) + .8 + (4 - k) * .35
			_put(b, "box", "rock", p, ss, lat, top - float(sq.y) - .35, Vector3(8.0, .7, 25.0), Color("c4c6bd"), k * .06)
			for hole in 2:
				_put(b, "ball", "water", p, ss + hole * 7.0 - 3.0, lat + (1.3 if hole else -1.4), top - float(sq.y) + .018, Vector3(2.3, .035, 3.3), Color("5a9993"))
	if "kite" in tags or "kites" in tags:
		var kite_colors: Array[Color] = [Color("d36749"), Color("e4bf54"), Color("5c9fc2"), Color("e5d4a7")]
		for k in 4:
			var ss: float = s + k * 29.0
			var kq: Dictionary = _sample(p, ss)
			var lat: float = _edge(kq, 1, 20.0 + k * 9.0)
			var h: float = 25.0 + k * 7.0
			_put(b, "kite", "facade", p, ss, lat, h, Vector3(1.8, 1.8, 1.0), kite_colors[k])
			_beam(b, "dark", _position(kq, lat, h - 2.0), _position(_sample(p, ss - 12.0), _edge(kq, 1, 6.0), 1.0), .015)
	if "hakka" in tags or "hakkavillage" in tags:
		var lat: float = _edge(q, -1, 32.0)
		var brick: Color = Color("a86b50")
		_put(b, "box", "facade", p, s, lat - 5.0, 3.0, Vector3(8.0, 6.0, 28.0), brick)
		_put(b, "roof", "roof", p, s, lat - 5.0, 6.0, Vector3(4.8, 2.8, 14.8))
		for ds in [-11.0, 11.0]:
			_put(b, "box", "facade", p, s + ds, lat + 4.0, 2.5, Vector3(17.0, 5.0, 5.5), brick)
			_put(b, "roof", "roof", p, s + ds, lat + 4.0, 5.0, Vector3(9.0, 1.8, 3.2))
			for dd in [-3.0, 3.0]:
				_put(b, "box", "dark", p, s + ds - signf(ds) * 2.8, lat + dd, 2.5, Vector3(1.5, 2.0, .1))
	if str(p._id) == "s5a" and "fortsandomingo" in tags:
		var lat: float = _edge(q, -1, 37.0)
		_put(b, "box", "facade", p, s, lat, 5.5, Vector3(19.0, 11.0, 28.0), Color("ae6045"))
		for ds in [-11.0, -5.5, 0.0, 5.5, 11.0]:
			_put(b, "box", "facade", p, s + ds, lat + 9.6, 11.6, Vector3(1.3, 1.6, 2.2), Color("a85a40"))
			_put(b, "box", "dark", p, s + ds, lat + 9.6, 5.4, Vector3(.08, 2.6, 1.15))
		_put(b, "pole", "silver", p, s, lat, 16.0, Vector3(.06, 10.0, .06))
		_put(b, "box", "red", p, s + 1.7, lat, 19.0, Vector3(.04, 1.6, 3.2))
	if "oysters" in tags:
		for row in 4:
			for col in 4:
				var ss: float = s + (col - 1.5) * 5.0
				var lat: float = _edge(q, 1, 27.0 + row * 5.0)
				_put(b, "pole", "bark", p, ss, lat, float(p._sea_level) + 1.1 - float(q.y), Vector3(.07, 2.2, .07))
				_put(b, "box", "bark", p, ss, lat + 2.4, float(p._sea_level) + 2.0 - float(q.y), Vector3(5.0, .1, .1))
	if "tribalgate" in tags or "totem" in tags:
		for ds in [-4.0, 4.0]:
			var lat: float = _edge(q, -1, 7.0)
			_put(b, "pole", "bark", p, s + ds, lat, 3.1, Vector3(.48, 6.2, .48))
			for band in 6:
				_put(b, "pole", "facade", p, s + ds, lat, .8 + band * .8, Vector3(.5, .25, .5), Color("d9c7a5") if band % 2 else Color("a74835"))
		_put(b, "box", "bark", p, s, _edge(q, -1, 7.0), 6.1, Vector3(.8, .7, 10.0))
	if "pingxi" in tags or "skylantern" in tags:
		for k in 9:
			var ss: float = s + rng.randf_range(-70.0, 70.0)
			var lat: float = rng.randf_range(-85.0, 85.0)
			var h: float = rng.randf_range(20.0, 65.0)
			var paper: Color = Color("d3b672") if k % 3 == 0 else Color("bd7052") if k % 3 == 1 else Color("d8ceb1")
			_put(b, "ball", "facade", p, ss, lat, h, Vector3(1.2, 1.55, 1.2), paper)
			_put(b, "box", "dark", p, ss, lat, h - 1.25, Vector3(.65, .1, .65))
	if "jiufen" in tags or "redlanterns" in tags or "lanterns" in tags:
		var lat: float = _edge(q, -1, 6.0)
		for k in 12:
			_put(b, "ball", "red", p, s - 27.0 + k * 5.0, lat, 4.3, Vector3(.48, .62, .48), Color("e0a877"))
			_put(b, "box", "yellow", p, s - 27.0 + k * 5.0, lat, 3.6, Vector3(.05, .3, .05))
	if "fishvillage" in tags or "fishboats" in tags or "nanfangao" in tags or "chenggong" in tags:
		for k in 3:
			var ss: float = s + k * 23.0
			var lat: float = _edge(q, 1, 40.0 + k * 9.0)
			var base: float = float(p._sea_level) - float(_sample(p, ss).y)
			_put(b, "box", "facade", p, ss, lat, base + .6, Vector3(5.5, 2.3, 17.0), Color("588a9d"))
			_put(b, "box", "white", p, ss - 3.0, lat, base + 2.4, Vector3(3.8, 2.8, 5.0))
			_put(b, "pole", "bark", p, ss + 2.0, lat, base + 5.0, Vector3(.08, 10.0, .08))
	if "railway" in tags or "jiji" in tags or "sugarfactory" in tags:
		var lat: float = _edge(q, -1, 22.0)
		_put(b, "box", "facade", p, s, lat, 2.2, Vector3(8.0, 4.4, 19.0), Color("a08b6c"))
		_put(b, "roof", "roof", p, s, lat, 4.4, Vector3(5.2, 2.2, 11.5))
		_put(b, "box", "dark", p, s, lat + 4.1, 2.1, Vector3(.08, 2.8, 10.0))

func _boardwalk(b: Dictionary, p: Dictionary, s: float) -> void:
	var q: Dictionary = _sample(p, s)
	var edge: float = float(q.right)
	var base: float = float(p._sea_level) + 1.25 - float(q.y)
	_put(b, "box", "bark", p, s, edge + 47.0, base, Vector3(85.0, .22, 3.2))
	for off in range(6, 90, 4):
		_put(b, "box", "bark", p, s, edge + off, base + .13, Vector3(.11, .04, 3.2), Color("d1bb8f"))
		for ds in [-1.4, 1.4]:
			_put(b, "pole", "bark", p, s + ds, edge + off, base, Vector3(.07, 2.5, .07))
			_put(b, "box", "bark", p, s + ds, edge + off, base + 1.0, Vector3(4.1, .09, .09))

func _eight_arch_bridge(b: Dictionary, p: Dictionary, s: float) -> void:
	var q: Dictionary = _sample(p, s)
	var edge: float = float(q.right)
	var sea: float = float(p._sea_level) - float(q.y)
	for arch in 8:
		for j in 12:
			var t0: float = j / 12.0
			var t1: float = (j + 1) / 12.0
			var x0: float = edge + 43.0 + arch * 20.0 + t0 * 20.0
			var x1: float = edge + 43.0 + arch * 20.0 + t1 * 20.0
			var h0: float = sea + 2.6 + sin(t0 * PI) * 4.3
			var h1: float = sea + 2.6 + sin(t1 * PI) * 4.3
			_beam(b, "white", _position(q, x0, h0), _position(q, x1, h1), .5, 3.1)
			for ds in [-1.3, 1.3]:
				var rq: Dictionary = _sample(p, s + ds)
				_beam(b, "white", _position(rq, x0, h0 + 1.0), _position(rq, x1, h1 + 1.0), .08)
	for k in 4:
		_put(b, "ball", "concrete", p, s + (k - 1.5) * 13.0, edge + 229.0 + k * 4.0, sea + 3.0, Vector3(12.0 + k * 2.0, 8.0 + k * 2.0, 10.0 + k * 2.0))

func _red_bridge(b: Dictionary, p: Dictionary, s: float, ruin: bool) -> void:
	var lat: float = _edge(_sample(p, s), 1, 43.0)
	var spans: int = 3 if ruin else 5
	var width: float = 24.0 if ruin else 22.0
	for k in spans + 1:
		_put(b, "box", "red", p, s + k * width, lat, 3.0, Vector3(4.0, 15.0, 3.0), Color("c8986a") if ruin else Color.WHITE)
	for k in spans:
		if ruin and k == 1:
			continue
		if not ruin:
			_put(b, "box", "concrete", p, s + (k + .5) * width, lat, 5.1, Vector3(4.6, .5, width + .1))
		for j in 10:
			var t0: float = j / 10.0
			var t1: float = (j + 1) / 10.0
			var qa: Dictionary = _sample(p, s + (k + t0) * width)
			var qz: Dictionary = _sample(p, s + (k + t1) * width)
			_beam(b, "red", _position(qa, lat, (-3.0 if ruin else 5.5) + sin(t0 * PI) * 10.0), _position(qz, lat, (-3.0 if ruin else 5.5) + sin(t1 * PI) * 10.0), 1.3 if ruin else .4, 3.5 if ruin else .4)

func _build_chunk(p: Dictionary, index: int) -> Node3D:
	var a: float = index * CHUNK
	var z: float = minf(float(p._length), a + CHUNK)
	var group: Node3D = Node3D.new()
	group.name = str(p._id).replace(":", "_") + "_" + str(index)
	var surfaces: Dictionary = {}
	var batches: Dictionary = {}
	_build_colliders = []
	var rng: RandomNumberGenerator = RandomNumberGenerator.new()
	rng.seed = int(p.get("seed", str(p._id).hash())) ^ (index * 97483)
	_road(surfaces, batches, p, a, z)
	var sections: Array = p.get("sections", p.get("secs", []))
	for sec in sections:
		var start: float = maxf(a, float(sec.get("start", 0.0)))
		var end: float = minf(z, float(sec.get("end", p._length)))
		if end > start:
			if bool(sec.get("track", false)):
				for sg in [-1, 1]:
					for rail in [-.55, .55]:
						_ribbon(surfaces, "silver", p, start, end, [rail - .04, rail + .04], "rail", sg, "grass", 4.0, sg * .5)
				for ss in range(ceili(start / 2.4), ceili(end / 2.4)):
					var track_s: float = ss * 2.4
					var q: Dictionary = _sample(p, track_s)
					for sg in [-1, 1]:
						_put(batches, "box", "bark", p, track_s, sg * float(q.hw) * .5, .048, Vector3(2.1, .04, .2))
			_side(surfaces, batches, p, start, end, sec, -1, rng)
			_side(surfaces, batches, p, start, end, sec, 1, rng)
	_landmarks(batches, p, a, z, rng)
	_finish_surfaces(group, surfaces)
	_finish_batches(group, batches)
	group.set_meta("last_seen", _clock)
	var pid: String = str(p._id)
	if not _collider_chunks.has(pid):
		_collider_chunks[pid] = {}
	_collider_chunks[pid][index] = _build_colliders
	group.set_meta("piece_id", pid)
	group.set_meta("index", index)
	_refresh_colliders(pid)
	add_child(group)
	return group

func _want(wanted: Dictionary, piece_id: String, lo: float, hi: float) -> void:
	if not _pieces.has(piece_id):
		return
	var p: Dictionary = _pieces[piece_id]
	if hi < 0.0 or lo > float(p._length):
		return
	var first: int = maxi(0, floori(lo / CHUNK))
	var last: int = mini(ceili(float(p._length) / CHUNK) - 1, floori(hi / CHUNK))
	for index in range(first, last + 1):
		wanted[piece_id + ":" + str(index)] = {"piece": piece_id, "index": index}

func update_view(piece_id: String, s: float, quality: String = "high") -> void:
	if not _pieces.has(piece_id):
		return
	_clock = Time.get_ticks_msec() / 1000.0
	_low = quality in ["low", "mobile"]
	_distance = 850.0 if _low else 1400.0
	var p: Dictionary = _pieces[piece_id]
	var wanted: Dictionary = {}
	_want(wanted, piece_id, s - 280.0, s + _distance)
	var parent_id: String = _resolve_id(p.get("parent"))
	if s < 500.0 and not parent_id.is_empty():
		var parent: Dictionary = _pieces[parent_id]
		_want(wanted, parent_id, float(parent._length) + s - 350.0, float(parent._length))
		for child in parent.get("children", []):
			var sibling: String = _resolve_id(child)
			if sibling != piece_id:
				_want(wanted, sibling, 0.0, minf(600.0, s + 350.0))
	var remain: float = float(p._length) - s
	if remain < _distance:
		for child in p.get("children", []):
			_want(wanted, _resolve_id(child), 0.0, _distance - remain)
		var next_id: String = _resolve_id(p.get("next"))
		if not next_id.is_empty():
			_want(wanted, next_id, 0.0, _distance - remain)
	var queue: Array = wanted.keys()
	queue.sort_custom(func(a: String, z: String) -> bool:
		var qa: Dictionary = wanted[a]
		var qz: Dictionary = wanted[z]
		if str(qa.piece) == piece_id and int(qa.index) == floori(s / CHUNK):
			return true
		if str(qz.piece) == piece_id and int(qz.index) == floori(s / CHUNK):
			return false
		return absf(float(_pieces[qa.piece].get("gS", 0.0)) + (int(qa.index) + .5) * CHUNK - float(p.get("gS", 0.0)) - s) < absf(float(_pieces[qz.piece].get("gS", 0.0)) + (int(qz.index) + .5) * CHUNK - float(p.get("gS", 0.0)) - s)
	)
	# One new chunk per frame spreads startup and branch loading across frames.
	# The current chunk is always built first; 850+ metres are queued in advance.
	var budget: int = 1
	var queued: int = 0
	var instances: int = 0
	for key in queue:
		if not _chunks.has(key):
			if budget <= 0:
				queued += 1
				continue
			var request: Dictionary = wanted[key]
			_chunks[key] = _build_chunk(_pieces[request.piece], int(request.index))
			budget -= 1
		var chunk: Node3D = _chunks[key]
		chunk.visible = true
		chunk.set_meta("last_seen", _clock)
		instances += int(chunk.get_meta("instances", 0))
	for key in _chunks.keys():
		if not wanted.has(key):
			var chunk: Node3D = _chunks[key]
			chunk.visible = false
			if _chunks.size() > (16 if _low else 25) or _clock - float(chunk.get_meta("last_seen", 0.0)) > 25.0:
				var pid: String = str(chunk.get_meta("piece_id"))
				_collider_chunks[pid].erase(chunk.get_meta("index"))
				_refresh_colliders(pid)
				chunk.queue_free()
				_chunks.erase(key)
	stats = {"chunks": wanted.size() - queued, "queued": queued, "instances": instances, "quality": quality}
