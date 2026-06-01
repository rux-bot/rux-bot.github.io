/**
 * 3D场景编辑器 - 全局脚本 (Three.js r128)
 */
var scene, camera, renderer, orbitControls, transformControls;
var ground, gridHelper;
var sceneObjects = [];
var selectedObj = null;
var transformMode = 'translate';
var raycaster, mouse;
var idCounter = 0;

var DUMMY_COLORS = [
  { shirt: 0x4488CC, pants: 0x334455 },
  { shirt: 0xCC4444, pants: 0x333333 },
  { shirt: 0x44CC44, pants: 0x554433 },
  { shirt: 0xCC8844, pants: 0x224444 },
  { shirt: 0x8844CC, pants: 0x444444 },
  { shirt: 0x44CCCC, pants: 0x333355 },
  { shirt: 0xCC44AA, pants: 0x334433 },
  { shirt: 0xCCCC44, pants: 0x443333 },
  { shirt: 0x44AA88, pants: 0x555533 },
  { shirt: 0xAA4466, pants: 0x334455 },
];
var colorIndex = 0;

var POSE_INFO = {
  standing:  { name: '站立', icon: '🧍' },
  sitting:   { name: '坐姿', icon: '🪑' },
  lying:     { name: '躺姿', icon: '🛏️' },
  squatting: { name: '蹲姿', icon: '🧎' },
  bending:   { name: '弯腰', icon: '🙇' },
  walking:   { name: '行走', icon: '🚶' }
};


// ==================== 初始化 ====================
function init() {
  var canvas = document.getElementById('canvas3d');
  var vp = document.getElementById('viewport');
  var w = vp.clientWidth, h = vp.clientHeight;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0d1117);
  scene.fog = new THREE.FogExp2(0x0d1117, 0.005);

  camera = new THREE.PerspectiveCamera(60, w / h, 0.1, 10000);
  camera.position.set(25, 20, 25);

  renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  renderer.setSize(w, h);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;

  setupLights(); setupGround(); setupControls();
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  bindEvents(); animate();
}

function setupLights() {
  scene.add(new THREE.AmbientLight(0xffffff, 0.5));
  var sun = new THREE.DirectionalLight(0xffffff, 1.0);
  sun.position.set(50, 80, 50);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5; sun.shadow.camera.far = 300;
  sun.shadow.camera.left = -100; sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100; sun.shadow.camera.bottom = -100;
  sun.shadow.bias = -0.0001;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x88aacc, 0x443322, 0.3));
}

function setupGround() {
  gridHelper = new THREE.GridHelper(2000, 200, 0x333355, 0x1a1a33);
  gridHelper.material.opacity = 0.5;
  gridHelper.material.transparent = true;
  scene.add(gridHelper);
  var gMat = new THREE.MeshStandardMaterial({ color: 0x0f0f1a, roughness: 0.95, metalness: 0.05 });
  ground = new THREE.Mesh(new THREE.PlaneGeometry(5000, 5000), gMat);
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.01;
  ground.receiveShadow = true; ground.userData.isGround = true;
  scene.add(ground);
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0.02,0), new THREE.Vector3(5,0.02,0)]), new THREE.LineBasicMaterial({color:0xff4444})));
  scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0.02,0), new THREE.Vector3(0,0.02,5)]), new THREE.LineBasicMaterial({color:0x4444ff})));
}

function setupControls() {
  orbitControls = new THREE.OrbitControls(camera, renderer.domElement);
  orbitControls.enableDamping = true;
  orbitControls.dampingFactor = 0.06;
  orbitControls.rotateSpeed = 0.6;
  orbitControls.screenSpacePanning = true;
  orbitControls.minDistance = 3;
  orbitControls.maxDistance = 300;
  orbitControls.maxPolarAngle = Math.PI / 2 - 0.02; // 不能看到场景背面
  orbitControls.minPolarAngle = 0.05;
  orbitControls.target.set(0, 0, 0);
  // 左键=旋转（翻转+旋转），中键=平移，右键=无
  orbitControls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: -1 };

  transformControls = new THREE.TransformControls(camera, renderer.domElement);
  transformControls.setSize(0.75);
  transformControls.setSpace('world');
  scene.add(transformControls);
  transformControls.addEventListener('dragging-changed', function(e) { orbitControls.enabled = !e.value; });
  transformControls.addEventListener('change', function() { if (selectedObj) updatePropPanel(selectedObj); });
}

function nextDummyColors() { return DUMMY_COLORS[colorIndex++ % DUMMY_COLORS.length]; }

// ==================== 假人模型 ====================
function createDummy(pose, colors) {
  var g = new THREE.Group();
  var skin = new THREE.MeshStandardMaterial({ color: 0xFFDBAC, roughness: 0.7 });
  var shirt = new THREE.MeshStandardMaterial({ color: colors.shirt, roughness: 0.6 });
  var pants = new THREE.MeshStandardMaterial({ color: colors.pants, roughness: 0.7 });
  var shoe = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });

  var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16), skin); head.castShadow = true;
  var torso = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.25), shirt); torso.castShadow = true;
  var lArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.13), shirt); lArm.castShadow = true;
  var rArm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.55, 0.13), shirt); rArm.castShadow = true;
  var lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), pants); lLeg.castShadow = true;
  var rLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.55, 0.16), pants); rLeg.castShadow = true;
  var lFoot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.25), shoe); lFoot.castShadow = true;
  var rFoot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.25), shoe); rFoot.castShadow = true;

  applyPose(pose, head, torso, lArm, rArm, lLeg, rLeg, lFoot, rFoot);
  g.add(head, torso, lArm, rArm, lLeg, rLeg, lFoot, rFoot);
  g.userData = { type: 'dummy', pose: pose, name: '假人-' + POSE_INFO[pose].name, colors: colors };
  return g;
}

function applyPose(pose, head, torso, lArm, rArm, lLeg, rLeg, lFoot, rFoot) {
  [head, torso, lArm, rArm, lLeg, rLeg, lFoot, rFoot].forEach(function(m) { m.position.set(0,0,0); m.rotation.set(0,0,0); });
  switch (pose) {
    case 'standing':
      head.position.set(0,1.65,0); torso.position.set(0,1.2,0);
      lArm.position.set(-0.35,1.15,0); rArm.position.set(0.35,1.15,0);
      lLeg.position.set(-0.11,0.52,0); rLeg.position.set(0.11,0.52,0);
      lFoot.position.set(-0.11,0.04,0.05); rFoot.position.set(0.11,0.04,0.05); break;
    case 'sitting':
      head.position.set(0,1.15,0); torso.position.set(0,0.72,0);
      lArm.position.set(-0.33,0.72,0); lArm.rotation.z=0.15;
      rArm.position.set(0.33,0.72,0); rArm.rotation.z=-0.15;
      lLeg.position.set(-0.11,0.25,0.15); lLeg.rotation.x=-Math.PI/2;
      rLeg.position.set(0.11,0.25,0.15); rLeg.rotation.x=-Math.PI/2;
      lFoot.position.set(-0.11,0.04,0.4); rFoot.position.set(0.11,0.04,0.4); break;
    case 'lying':
      head.position.set(0,0.22,-0.7); head.rotation.x=Math.PI/2;
      torso.position.set(0,0.22,-0.15); torso.rotation.x=Math.PI/2;
      lArm.position.set(-0.35,0.22,-0.15); lArm.rotation.x=Math.PI/2;
      rArm.position.set(0.35,0.22,-0.15); rArm.rotation.x=Math.PI/2;
      lLeg.position.set(-0.11,0.22,0.5); lLeg.rotation.x=Math.PI/2;
      rLeg.position.set(0.11,0.22,0.5); rLeg.rotation.x=Math.PI/2;
      lFoot.position.set(-0.11,0.04,0.85); lFoot.rotation.x=Math.PI/2;
      rFoot.position.set(0.11,0.04,0.85); rFoot.rotation.x=Math.PI/2; break;
    case 'squatting':
      head.position.set(0,0.75,0.1); torso.position.set(0,0.45,0.1); torso.rotation.x=0.2;
      lArm.position.set(-0.3,0.5,0.15); lArm.rotation.x=-0.3;
      rArm.position.set(0.3,0.5,0.15); rArm.rotation.x=-0.3;
      lLeg.position.set(-0.13,0.18,0.15); lLeg.rotation.x=-1.3;
      rLeg.position.set(0.13,0.18,0.15); rLeg.rotation.x=-1.3;
      lFoot.position.set(-0.13,0.04,-0.1); rFoot.position.set(0.13,0.04,-0.1); break;
    case 'bending':
      head.position.set(0,0.85,0.35); torso.position.set(0,0.7,0.12); torso.rotation.x=Math.PI/3;
      lArm.position.set(-0.3,0.45,0.25); lArm.rotation.x=0.8;
      rArm.position.set(0.3,0.45,0.25); rArm.rotation.x=0.8;
      lLeg.position.set(-0.11,0.45,-0.05); rLeg.position.set(0.11,0.45,-0.05);
      lFoot.position.set(-0.11,0.04,-0.05); rFoot.position.set(0.11,0.04,-0.05); break;
    case 'walking':
      head.position.set(0,1.65,0); torso.position.set(0,1.2,0); torso.rotation.z=0.03;
      lArm.position.set(-0.35,1.15,0); lArm.rotation.x=0.5;
      rArm.position.set(0.35,1.15,0); rArm.rotation.x=-0.5;
      lLeg.position.set(-0.11,0.52,0); lLeg.rotation.x=-0.5;
      rLeg.position.set(0.11,0.52,0); rLeg.rotation.x=0.5;
      lFoot.position.set(-0.11,0.04,0.15); rFoot.position.set(0.11,0.04,-0.1); break;
  }
}

function changeDummyPose(obj, p) {
  var c = obj.children; if (c.length < 8) return;
  applyPose(p, c[0], c[1], c[2], c[3], c[4], c[5], c[6], c[7]);
  obj.userData.pose = p; obj.userData.name = '假人-' + POSE_INFO[p].name;
  if (selectionBox) selectionBox.update();
  updatePropPanel(obj); updateObjList();
  setStatus('姿势: ' + POSE_INFO[p].name);
}

// ==================== 立体图形 ====================
var shapeColors = [0x4488CC, 0x44CC44, 0xCC8844, 0xCC4444, 0x8844CC, 0x44CCCC, 0xCC44AA, 0xCCCC44];
var shapeColorIdx = 0;

function addShape(type) {
  var color = shapeColors[shapeColorIdx++ % shapeColors.length];
  var mat = new THREE.MeshStandardMaterial({ color: color, roughness: 0.4, metalness: 0.3 });
  var mesh, name;
  switch (type) {
    case 'box':
      mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat); name = '长方体'; break;
    case 'sphere':
      mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 24), mat); name = '球体'; break;
    case 'cylinder':
      mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 24), mat); name = '圆柱'; break;
    case 'cone':
      mesh = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 24), mat); name = '圆锥'; break;
    case 'torus':
      mesh = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.15, 16, 32), mat); name = '圆环'; break;
    case 'pyramid':
      mesh = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1, 4), mat); name = '棱锥'; break;
    case 'wedge':
      var shape = new THREE.Shape();
      shape.moveTo(-0.5, 0); shape.lineTo(0.5, 0); shape.lineTo(0.5, 1); shape.lineTo(-0.5, 0);
      var ext = { depth: 1, bevelEnabled: false };
      mesh = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, ext), mat);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.5;
      name = '楔体'; break;
    case 'capsule':
      mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 8, 16), mat); name = '胶囊'; break;
    case 'diamond':
      var geo = new THREE.OctahedronGeometry(0.5);
      mesh = new THREE.Mesh(geo, mat); name = '菱形'; break;
  }
  if (!mesh) return;
  mesh.castShadow = true; mesh.receiveShadow = true;
  var g = new THREE.Group();
  g.add(mesh);
  g.userData = { type: 'shape', shapeType: type, name: name, color: color };
  placeInFront(g); registerObject(g);
}

// ==================== 建筑模型 ====================
function createBuilding(type) {
  var g = new THREE.Group();
  switch (type) {
    case 'house': {
      var w=new THREE.MeshStandardMaterial({color:0xE8E0D8,roughness:0.8});
      var r=new THREE.MeshStandardMaterial({color:0x8B4513,roughness:0.7});
      var d=new THREE.MeshStandardMaterial({color:0x654321,roughness:0.6});
      var wi=new THREE.MeshStandardMaterial({color:0x87CEEB,roughness:0.3,metalness:0.5});
      var b=new THREE.Mesh(new THREE.BoxGeometry(4,3,5),w);b.position.y=1.5;b.castShadow=true;b.receiveShadow=true;
      var rf=new THREE.Mesh(new THREE.ConeGeometry(3.5,2,4),r);rf.position.y=4;rf.rotation.y=Math.PI/4;rf.castShadow=true;
      var dr=new THREE.Mesh(new THREE.BoxGeometry(1,2,0.12),d);dr.position.set(0,1,2.56);
      var w1=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.8,0.12),wi);w1.position.set(-1.3,2,2.56);
      var w2=new THREE.Mesh(new THREE.BoxGeometry(0.8,0.8,0.12),wi);w2.position.set(1.3,2,2.56);
      g.add(b,rf,dr,w1,w2);g.userData.name='房屋';break;
    }
    case 'tower': {
      var m1=new THREE.MeshStandardMaterial({color:0xCCCCCC,roughness:0.7});
      var m2=new THREE.MeshStandardMaterial({color:0xBBBBDD,roughness:0.7});
      var wm=new THREE.MeshStandardMaterial({color:0x87CEEB,roughness:0.3,metalness:0.6});
      for(var i=0;i<8;i++){var f=new THREE.Mesh(new THREE.BoxGeometry(5,3,5),i%2===0?m1:m2);f.position.y=1.5+i*3;f.castShadow=true;f.receiveShadow=true;g.add(f);for(var s=-1;s<=1;s+=2){var wn=new THREE.Mesh(new THREE.BoxGeometry(0.8,1.5,0.12),wm);wn.position.set(s*1.5,1.5+i*3,2.56);g.add(wn);}}
      g.userData.name='高楼';break;
    }
    case 'warehouse': {
      var wm2=new THREE.MeshStandardMaterial({color:0x888888,roughness:0.8});
      var dm=new THREE.MeshStandardMaterial({color:0x666666,roughness:0.7});
      var b2=new THREE.Mesh(new THREE.BoxGeometry(8,4,12),wm2);b2.position.y=2;b2.castShadow=true;b2.receiveShadow=true;
      var dr2=new THREE.Mesh(new THREE.BoxGeometry(3,3.5,0.12),dm);dr2.position.set(0,1.75,6.06);
      g.add(b2,dr2);g.userData.name='仓库';break;
    }
    case 'pavilion': {
      var pm=new THREE.MeshStandardMaterial({color:0xCC0000,roughness:0.5});
      var rm=new THREE.MeshStandardMaterial({color:0x8B0000,roughness:0.6});
      var bm=new THREE.MeshStandardMaterial({color:0x888888,roughness:0.8});
      for(var i=0;i<6;i++){var a=(i/6)*Math.PI*2;var p=new THREE.Mesh(new THREE.CylinderGeometry(0.15,0.15,3,8),pm);p.position.set(Math.cos(a)*2,1.5,Math.sin(a)*2);p.castShadow=true;g.add(p);}
      var rf2=new THREE.Mesh(new THREE.ConeGeometry(3,1.5,6),rm);rf2.position.y=3.75;rf2.castShadow=true;
      var bs=new THREE.Mesh(new THREE.CylinderGeometry(2.5,2.5,0.3,12),bm);bs.position.y=0.15;bs.receiveShadow=true;
      g.add(rf2,bs);g.userData.name='亭子';break;
    }
    case 'wall': {
      var mt=new THREE.MeshStandardMaterial({color:0xBBBBBB,roughness:0.8});
      var wl=10;var wall=new THREE.Mesh(new THREE.BoxGeometry(wl,2,0.3),mt);wall.position.y=1;wall.castShadow=true;wall.receiveShadow=true;
      for(var i=0;i<6;i++){var m=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.5,0.35),mt);m.position.set(-wl/2+1+i*2,2.25,0);g.add(m);}
      g.add(wall);g.userData.name='围墙';break;
    }
    case 'gate': {
      var fm=new THREE.MeshStandardMaterial({color:0xBBBBBB,roughness:0.7});
      var tm=new THREE.MeshStandardMaterial({color:0x8B0000,roughness:0.5});
      var dm2=new THREE.MeshStandardMaterial({color:0x222222});
      var fr=new THREE.Mesh(new THREE.BoxGeometry(6,5,0.5),fm);fr.position.y=2.5;fr.castShadow=true;
      var hl=new THREE.Mesh(new THREE.BoxGeometry(3,4,0.6),dm2);hl.position.set(0,2,0);
      var tp=new THREE.Mesh(new THREE.BoxGeometry(7,0.5,0.6),tm);tp.position.y=5.25;tp.castShadow=true;
      g.add(fr,hl,tp);g.userData.name='大门';break;
    }
  }
  g.userData.type='building';
  return g;
}

// ==================== 场景配件 ====================
function createOther(type) {
  var g = new THREE.Group();
  switch (type) {
    case 'tree': {
      var tk=new THREE.MeshStandardMaterial({color:0x8B4513,roughness:0.9});
      var lf=new THREE.MeshStandardMaterial({color:0x228B22,roughness:0.8});
      var tr=new THREE.Mesh(new THREE.CylinderGeometry(0.2,0.3,2,8),tk);tr.position.y=1;tr.castShadow=true;
      var c1=new THREE.Mesh(new THREE.SphereGeometry(1.3,12,12),lf);c1.position.y=3;c1.castShadow=true;
      var c2=new THREE.Mesh(new THREE.SphereGeometry(0.9,10,10),lf);c2.position.set(0.5,3.5,0.3);c2.castShadow=true;
      g.add(tr,c1,c2);g.userData.name='树木';break;
    }
    case 'car': {
      var bm=new THREE.MeshStandardMaterial({color:0xEE3333,roughness:0.3,metalness:0.7});
      var gm=new THREE.MeshStandardMaterial({color:0x87CEEB,roughness:0.1,metalness:0.8});
      var wm=new THREE.MeshStandardMaterial({color:0x222222,roughness:0.9});
      var lm=new THREE.MeshStandardMaterial({color:0xFFFF88,emissive:0xFFFF44,emissiveIntensity:0.3});
      var bd=new THREE.Mesh(new THREE.BoxGeometry(2,0.7,4.2),bm);bd.position.y=0.55;bd.castShadow=true;
      var cn=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.55,2),gm);cn.position.set(0,1.15,-0.2);
      var wg=new THREE.CylinderGeometry(0.28,0.28,0.18,12);
      [[-0.95,0.28,1.3],[0.95,0.28,1.3],[-0.95,0.28,-1.3],[0.95,0.28,-1.3]].forEach(function(p){var w=new THREE.Mesh(wg,wm);w.position.set(p[0],p[1],p[2]);w.rotation.z=Math.PI/2;g.add(w);});
      var h1=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.15,0.05),lm);h1.position.set(-0.7,0.6,2.15);
      var h2=new THREE.Mesh(new THREE.BoxGeometry(0.3,0.15,0.05),lm);h2.position.set(0.7,0.6,2.15);
      g.add(bd,cn,h1,h2);g.userData.name='汽车';break;
    }
    case 'bench': {
      var wd=new THREE.MeshStandardMaterial({color:0x8B4513,roughness:0.7});
      var mt=new THREE.MeshStandardMaterial({color:0x444444,roughness:0.4,metalness:0.8});
      var st=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.08,0.5),wd);st.position.y=0.48;
      var bk=new THREE.Mesh(new THREE.BoxGeometry(2.2,0.5,0.06),wd);bk.position.set(0,0.78,-0.22);bk.rotation.x=-0.1;
      var lg=new THREE.BoxGeometry(0.06,0.48,0.06);
      [[-0.9,0.24,0.18],[0.9,0.24,0.18],[-0.9,0.24,-0.18],[0.9,0.24,-0.18]].forEach(function(p){var l=new THREE.Mesh(lg,mt);l.position.set(p[0],p[1],p[2]);g.add(l);});
      g.add(st,bk);g.userData.name='长椅';break;
    }
    case 'lamp': {
      var pm=new THREE.MeshStandardMaterial({color:0x555555,roughness:0.3,metalness:0.8});
      var sm=new THREE.MeshStandardMaterial({color:0x777777,roughness:0.4,metalness:0.5});
      var bm2=new THREE.MeshStandardMaterial({color:0xFFFF88,emissive:0xFFFF44,emissiveIntensity:0.6});
      var po=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.08,4,8),pm);po.position.y=2;po.castShadow=true;
      var ar=new THREE.Mesh(new THREE.BoxGeometry(1,0.05,0.05),pm);ar.position.set(0.5,3.9,0);
      var sh=new THREE.Mesh(new THREE.ConeGeometry(0.35,0.2,8),sm);sh.position.set(1,3.85,0);sh.rotation.x=Math.PI;
      var bl=new THREE.Mesh(new THREE.SphereGeometry(0.08,8,8),bm2);bl.position.set(1,3.72,0);
      var li=new THREE.PointLight(0xFFFFAA,0.8,15);li.position.set(1,3.7,0);li.castShadow=true;
      g.add(po,ar,sh,bl,li);g.userData.name='路灯';break;
    }
    case 'table': {
      var topMat=new THREE.MeshStandardMaterial({color:0xDEB887,roughness:0.6});
      var legMat=new THREE.MeshStandardMaterial({color:0x8B7355,roughness:0.5});
      var top=new THREE.Mesh(new THREE.BoxGeometry(2,0.08,1.2),topMat);top.position.y=0.76;top.castShadow=true;top.receiveShadow=true;
      var tlg=new THREE.BoxGeometry(0.08,0.76,0.08);
      [[-0.9,0.38,-0.5],[0.9,0.38,-0.5],[-0.9,0.38,0.5],[0.9,0.38,0.5]].forEach(function(p){var l=new THREE.Mesh(tlg,legMat);l.position.set(p[0],p[1],p[2]);l.castShadow=true;g.add(l);});
      g.add(top);g.userData.name='桌子';break;
    }
    case 'chair': {
      var sMat=new THREE.MeshStandardMaterial({color:0xA0522D,roughness:0.6});
      var clMat=new THREE.MeshStandardMaterial({color:0x654321,roughness:0.5});
      var seat=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.05,0.5),sMat);seat.position.y=0.45;seat.castShadow=true;
      var back=new THREE.Mesh(new THREE.BoxGeometry(0.5,0.4,0.05),sMat);back.position.set(0,0.7,-0.22);back.castShadow=true;
      var clg=new THREE.BoxGeometry(0.05,0.45,0.05);
      [[-0.2,0.225,-0.2],[0.2,0.225,-0.2],[-0.2,0.225,0.2],[0.2,0.225,0.2]].forEach(function(p){var l=new THREE.Mesh(clg,clMat);l.position.set(p[0],p[1],p[2]);l.castShadow=true;g.add(l);});
      g.add(seat,back);g.userData.name='椅子';break;
    }
    case 'bookshelf': {
      var shMat=new THREE.MeshStandardMaterial({color:0x8B6914,roughness:0.7});
      var sL=new THREE.Mesh(new THREE.BoxGeometry(0.06,1.8,0.4),shMat);sL.position.set(-0.6,0.9,0);sL.castShadow=true;
      var sR=new THREE.Mesh(new THREE.BoxGeometry(0.06,1.8,0.4),shMat);sR.position.set(0.6,0.9,0);sR.castShadow=true;
      var shGeo=new THREE.BoxGeometry(1.14,0.04,0.38);
      for(var si=0;si<5;si++){var sh2=new THREE.Mesh(shGeo,shMat);sh2.position.set(0,si*0.42+0.04,0);sh2.castShadow=true;g.add(sh2);}
      var bkP=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.8,0.03),shMat);bkP.position.set(0,0.9,-0.18);
      g.add(sL,sR,bkP);g.userData.name='书架';break;
    }
    case 'fence': {
      var fMat=new THREE.MeshStandardMaterial({color:0xD2B48C,roughness:0.7});
      var rail=new THREE.Mesh(new THREE.BoxGeometry(5,0.06,0.06),fMat);rail.position.set(0,0.6,0);rail.castShadow=true;
      var rail2=new THREE.Mesh(new THREE.BoxGeometry(5,0.06,0.06),fMat);rail2.position.set(0,0.3,0);rail2.castShadow=true;
      var pGeo=new THREE.BoxGeometry(0.08,0.9,0.08);
      for(var fi=-2;fi<=2;fi++){var post=new THREE.Mesh(pGeo,fMat);post.position.set(fi*1.2,0.45,0);post.castShadow=true;g.add(post);}
      g.add(rail,rail2);g.userData.name='栅栏';break;
    }
    case 'trashcan': {
      var tcMat=new THREE.MeshStandardMaterial({color:0x555555,roughness:0.4,metalness:0.6});
      var can=new THREE.Mesh(new THREE.CylinderGeometry(0.25,0.22,0.6,12),tcMat);can.position.y=0.3;can.castShadow=true;
      var lid=new THREE.Mesh(new THREE.CylinderGeometry(0.27,0.27,0.04,12),tcMat);lid.position.y=0.62;lid.castShadow=true;
      g.add(can,lid);g.userData.name='垃圾桶';break;
    }
    case 'flowerbed': {
      var soilMat=new THREE.MeshStandardMaterial({color:0x3d2817,roughness:0.95});
      var soil=new THREE.Mesh(new THREE.BoxGeometry(2,0.2,1),soilMat);soil.position.y=0.1;soil.receiveShadow=true;
      var fc=[0xFF6B6B,0xFFD93D,0xFF8C94,0xC084FC,0xF472B6];
      for(var fli=0;fli<8;fli++){
        var fMat=new THREE.MeshStandardMaterial({color:fc[fli%fc.length],roughness:0.5});
        var flower=new THREE.Mesh(new THREE.SphereGeometry(0.08,8,8),fMat);
        flower.position.set((Math.random()-0.5)*1.6,0.3+Math.random()*0.2,(Math.random()-0.5)*0.6);
        flower.castShadow=true;
        var stem=new THREE.Mesh(new THREE.CylinderGeometry(0.01,0.01,0.2,4),new THREE.MeshStandardMaterial({color:0x228B22}));
        stem.position.set(flower.position.x,0.15,flower.position.z);
        g.add(flower,stem);
      }
      g.add(soil);g.userData.name='花坛';break;
    }
    case 'box': {
      var bxMat=new THREE.MeshStandardMaterial({color:0xCD853F,roughness:0.8});
      var bx=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),bxMat);bx.position.y=0.5;bx.castShadow=true;bx.receiveShadow=true;
      g.add(bx);g.userData.name='箱子';break;
    }
  }
  g.userData.type='object';
  return g;
}

// ==================== 对象管理 ====================
function placeInFront(obj) {
  var fwd = new THREE.Vector3(0,0,-1);
  fwd.applyQuaternion(camera.quaternion);
  fwd.y = 0; fwd.normalize();
  obj.position.copy(orbitControls.target).add(fwd.multiplyScalar(8));
  obj.position.y = 0;
}

function registerObject(obj) {
  obj.userData.id = ++idCounter;
  scene.add(obj); sceneObjects.push(obj);
  selectObj(obj); updateObjList();
  setStatus('已添加: ' + obj.userData.name);
}

function addDummyFromPanel(pose) { var obj = createDummy(pose, nextDummyColors()); placeInFront(obj); registerObject(obj); }
function addBuilding(type) { var obj = createBuilding(type); placeInFront(obj); registerObject(obj); }
function addObject(type) { var obj = createOther(type); placeInFront(obj); registerObject(obj); }

// ==================== 选择 ====================
var selectionBox = null;
function selectObj(obj) {
  clearSelBox(); selectedObj = obj;
  if (obj) { if (transformMode !== 'select') transformControls.attach(obj); addSelBox(obj); updatePropPanel(obj); }
  else { transformControls.detach(); clearPropPanel(); }
  updateObjList();
}
function addSelBox(obj) { clearSelBox(); selectionBox = new THREE.BoxHelper(obj, 0x00d4ff); selectionBox.userData.isHelper = true; scene.add(selectionBox); }
function clearSelBox() { if (selectionBox) { scene.remove(selectionBox); if (selectionBox.geometry) selectionBox.geometry.dispose(); if (selectionBox.material) selectionBox.material.dispose(); selectionBox = null; } }

function deleteSelected() {
  if (!selectedObj) return;
  var idx = sceneObjects.indexOf(selectedObj); if (idx > -1) sceneObjects.splice(idx, 1);
  transformControls.detach(); clearSelBox(); scene.remove(selectedObj);
  selectedObj.traverse(function(c) { if (c.geometry) c.geometry.dispose(); if (c.material) { if (Array.isArray(c.material)) c.material.forEach(function(m){m.dispose();}); else c.material.dispose(); } });
  setStatus('已删除: ' + selectedObj.userData.name);
  selectedObj = null; clearPropPanel(); updateObjList();
}

var NAME_TO_BUILD = {'房屋':'house','高楼':'tower','仓库':'warehouse','亭子':'pavilion','围墙':'wall','大门':'gate'};
var NAME_TO_OBJ = {'树木':'tree','汽车':'car','长椅':'bench','路灯':'lamp','桌子':'table','椅子':'chair','书架':'bookshelf','栅栏':'fence','垃圾桶':'trashcan','花坛':'flowerbed','箱子':'box'};

function duplicateSelected() {
  if (!selectedObj) return; var obj;
  if (selectedObj.userData.type === 'dummy') obj = createDummy(selectedObj.userData.pose, nextDummyColors());
  else if (selectedObj.userData.type === 'building') obj = createBuilding(NAME_TO_BUILD[selectedObj.userData.name] || 'house');
  else if (selectedObj.userData.type === 'shape') { addShape(selectedObj.userData.shapeType); return; }
  else obj = createOther(NAME_TO_OBJ[selectedObj.userData.name] || 'tree');
  obj.position.copy(selectedObj.position); obj.position.x += 2;
  obj.rotation.copy(selectedObj.rotation); obj.scale.copy(selectedObj.scale);
  registerObject(obj); setStatus('已复制: ' + obj.userData.name);
}

// ==================== 属性面板 ====================
function updatePropPanel(obj) {
  var p = obj.position, r = obj.rotation, s = obj.scale;
  var isDummy = obj.userData.type === 'dummy';

  var html = '<div class="section"><div class="section-title">📌 ' + obj.userData.name + '</div>';

  if (isDummy) {
    html += '<div style="font-size:10px;color:#888;margin-bottom:6px;">当前: ' + POSE_INFO[obj.userData.pose].name + '</div>';
    html += '<div class="pose-selector">';
    ['standing','sitting','lying','squatting','bending','walking'].forEach(function(p) {
      html += '<div class="pose-btn' + (p === obj.userData.pose ? ' active' : '') + '" onclick="changeDummyPose(selectedObj,\'' + p + '\')">' + POSE_INFO[p].icon + '<br>' + POSE_INFO[p].name + '</div>';
    });
    html += '</div>';
    html += '<div style="margin-top:6px;font-size:10px;color:#888;">衣服颜色:</div><div class="color-row">';
    DUMMY_COLORS.forEach(function(c, i) {
      var hex = '#' + c.shirt.toString(16).padStart(6, '0');
      html += '<div class="color-swatch' + (JSON.stringify(obj.userData.colors) === JSON.stringify(c) ? ' active' : '') + '" style="background:' + hex + ';" onclick="changeDummyColor(selectedObj,' + i + ')"></div>';
    });
    html += '</div>';
  }
  html += '</div>';

  // 位置
  html += '<div class="section"><div class="section-title">位置</div>';
  html += inputRow('pos', 'X', p.x, -100, 100, 0.5);
  html += inputRow('pos', 'Y', p.y, -100, 100, 0.5);
  html += inputRow('pos', 'Z', p.z, -100, 100, 0.5);
  html += '</div>';

  // 旋转
  html += '<div class="section"><div class="section-title">旋转 (°)</div>';
  html += inputRow('rot', 'X', r.x * 180 / Math.PI, -180, 180, 5);
  html += inputRow('rot', 'Y', r.y * 180 / Math.PI, -180, 180, 5);
  html += inputRow('rot', 'Z', r.z * 180 / Math.PI, -180, 180, 5);
  html += '</div>';

  // 缩放
  html += '<div class="section"><div class="section-title">缩放</div>';
  html += inputRow('scl', 'X', s.x, 0.1, 10, 0.1);
  html += inputRow('scl', 'Y', s.y, 0.1, 10, 0.1);
  html += inputRow('scl', 'Z', s.z, 0.1, 10, 0.1);
  html += '</div>';

  // 按钮
  html += '<div class="section" style="border-bottom:none;display:flex;gap:6px;">';
  html += '<button class="btn btn-dup" onclick="duplicateSelected()" style="width:50%;">📋 复制</button>';
  html += '<button class="btn btn-delete" onclick="deleteSelected()" style="width:50%;">🗑️ 删除</button>';
  html += '</div>';

  document.getElementById('propPanel').innerHTML = html;
}

// [-] [slider] [input] [+] 行
function inputRow(prop, axis, val, min, max, step) {
  var v = Number(val).toFixed(step < 1 ? 1 : 0);
  var id = prop + '_' + axis;
  var stepStr = step < 1 ? step.toFixed(1) : String(step);
  return '<div class="prop-row">' +
    '<span class="prop-label">' + axis + '</span>' +
    '<div class="step-btn" onclick="stepVal(\'' + prop + '\',\'' + axis + '\',-' + stepStr + ')">−</div>' +
    '<input type="range" class="prop-slider" id="sl_' + id + '" min="' + min + '" max="' + max + '" step="' + stepStr + '" value="' + v + '" oninput="onSliderInput(\'' + prop + '\',\'' + axis + '\',this.value)">' +
    '<input type="number" class="prop-input" id="in_' + id + '" value="' + v + '" step="' + stepStr + '" onkeydown="onInputKey(event,\'' + prop + '\',\'' + axis + '\')" onblur="onInputBlur(\'' + prop + '\',\'' + axis + '\')">' +
    '<div class="step-btn" onclick="stepVal(\'' + prop + '\',\'' + axis + '\',' + stepStr + ')">+</div>' +
    '</div>';
}

function clearPropPanel() { document.getElementById('propPanel').innerHTML = '<div class="no-sel">点击左侧添加物体<br>选中后编辑属性</div>'; }

function onSliderInput(prop, axis, val) {
  if (!selectedObj) return;
  var v = parseFloat(val);
  applyValue(prop, axis.toLowerCase(), v);
  var inp = document.getElementById('in_' + prop + '_' + axis);
  if (inp) inp.value = v;
  if (selectionBox) selectionBox.update();
}

function onInputKey(e, prop, axis) {
  if (e.key === 'Enter') { e.preventDefault(); onInputBlur(prop, axis); e.target.blur(); }
}

function onInputBlur(prop, axis) {
  if (!selectedObj) return;
  var inp = document.getElementById('in_' + prop + '_' + axis);
  if (!inp) return;
  var v = parseFloat(inp.value);
  if (isNaN(v)) return;
  applyValue(prop, axis.toLowerCase(), v);
  var sl = document.getElementById('sl_' + prop + '_' + axis);
  if (sl) sl.value = v;
  if (selectionBox) selectionBox.update();
}

// +/- 按钮
function stepVal(prop, axis, delta) {
  if (!selectedObj) return;
  var inp = document.getElementById('in_' + prop + '_' + axis);
  if (!inp) return;
  var v = parseFloat(inp.value) || 0;
  v += delta;
  inp.value = v;
  applyValue(prop, axis.toLowerCase(), v);
  var sl = document.getElementById('sl_' + prop + '_' + axis);
  if (sl) sl.value = v;
  if (selectionBox) selectionBox.update();
}

function applyValue(prop, axis, v) {
  if (!selectedObj) return;
  if (prop === 'pos') selectedObj.position[axis] = v;
  else if (prop === 'rot') selectedObj.rotation[axis] = v * Math.PI / 180;
  else if (prop === 'scl') selectedObj.scale[axis] = v;
}

function changeDummyColor(obj, ci) {
  if (!obj || obj.userData.type !== 'dummy') return;
  var colors = DUMMY_COLORS[ci]; obj.userData.colors = colors;
  var c = obj.children;
  if (c.length >= 6) { c[1].material.color.setHex(colors.shirt); c[2].material.color.setHex(colors.shirt); c[3].material.color.setHex(colors.shirt); c[4].material.color.setHex(colors.pants); c[5].material.color.setHex(colors.pants); }
  updatePropPanel(obj); setStatus('颜色已更新');
}


// ==================== 对象列表 ====================
function updateObjList() {
  var list = document.getElementById('objList');
  if (sceneObjects.length === 0) { list.innerHTML = '<div style="color:#555;font-size:10px;padding:6px;">暂无对象</div>'; return; }
  var html = '';
  sceneObjects.forEach(function(obj) {
    var sel = selectedObj === obj ? ' selected' : '';
    var ch = obj.userData.type === 'dummy' ? '#' + obj.userData.colors.shirt.toString(16).padStart(6,'0') : (obj.userData.type === 'shape' ? '#' + obj.userData.color.toString(16).padStart(6,'0') : '#4488CC');
    html += '<div class="obj-item' + sel + '" onclick="selectById(' + obj.userData.id + ')"><div class="obj-dot" style="background:' + ch + ';"></div><span>' + obj.userData.name + '</span><span style="margin-left:auto;color:#444;">#' + obj.userData.id + '</span></div>';
  });
  list.innerHTML = html;
}
function selectById(id) { var obj = sceneObjects.find(function(o){return o.userData.id===id;}); if (obj) selectObj(obj); }
function setStatus(text) { document.getElementById('statusText').textContent = text; }

// ==================== 导出 ====================
function exportView() {
  var hidden = [];
  scene.traverse(function(c) { if (c.userData.isHelper || c === gridHelper || c === transformControls) { c.visible = false; hidden.push(c); } });
  transformControls.visible = false;
  renderer.render(scene, camera);
  var dataUrl = renderer.domElement.toDataURL('image/png');
  hidden.forEach(function(c){c.visible=true;}); transformControls.visible = true;
  var link = document.createElement('a'); link.download = '3d-scene-' + Date.now() + '.png'; link.href = dataUrl; link.click();
  setStatus('已导出二维平面图');
}

// ==================== 工具模式 ====================
function setMode(mode) {
  transformMode = mode;
  document.querySelectorAll('.tool-btn').forEach(function(b){b.classList.remove('active');});
  var ids = {select:'btnSelect',translate:'btnMove',rotate:'btnRotate',scale:'btnScale'};
  var btn = document.getElementById(ids[mode]); if (btn) btn.classList.add('active');
  if (mode === 'select') { transformControls.detach(); }
  else { transformControls.setMode(mode); if (selectedObj) transformControls.attach(selectedObj); }
  setStatus('工具: ' + {select:'选择',translate:'移动',rotate:'旋转',scale:'缩放'}[mode]);
}
function resetCamera() { camera.position.set(25,20,25); orbitControls.target.set(0,0,0); orbitControls.update(); setStatus('视角已重置'); }
function topView() { camera.position.set(0,50,0.01); orbitControls.target.set(0,0,0); orbitControls.update(); setStatus('俯视图'); }

// ==================== 事件绑定 ====================
function bindEvents() {
  var canvas = renderer.domElement;
  var downX = 0, downY = 0, downTime = 0;

  canvas.addEventListener('mousedown', function(e) {
    if (e.button === 0) { downX = e.clientX; downY = e.clientY; downTime = Date.now(); }
  });

  // 使用 mouseup 而非 click，以便精确控制阈值
  canvas.addEventListener('mouseup', function(e) {
    if (e.button === 0) {
      var dx = Math.abs(e.clientX - downX), dy = Math.abs(e.clientY - downY);
      var dt = Date.now() - downTime;
      // 移动<6px 且 时间<300ms 视为点击
      if (dx < 6 && dy < 6 && dt < 300) {
        doRaycastSelect(e);
      }
    }
  });

  function doRaycastSelect(e) {
    var rect = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    // 收集所有可点击mesh
    var meshes = [];
    sceneObjects.forEach(function(o) {
      o.traverse(function(c) { if (c.isMesh) meshes.push(c); });
    });
    var hits = raycaster.intersectObjects(meshes, false);

    if (hits.length > 0) {
      // 找到最近的顶级对象
      var clicked = hits[0].object;
      while (clicked.parent && sceneObjects.indexOf(clicked) === -1) clicked = clicked.parent;
      if (sceneObjects.indexOf(clicked) !== -1) {
        selectObj(clicked);
        setStatus('选中: ' + clicked.userData.name);
        return;
      }
    }
    // 点击空白处取消选择
    if (!transformControls.dragging) {
      selectObj(null);
      setStatus('就绪 | 左键旋转视角 | 左键点击选择 | 中键平移 | 滚轮缩放');
    }
  }

  canvas.addEventListener('contextmenu', function(e){e.preventDefault();});

  window.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT') return;
    switch (e.key.toLowerCase()) {
      case 'q': setMode('select'); break; case 'w': setMode('translate'); break;
      case 'e': setMode('rotate'); break; case 'r': setMode('scale'); break;
      case 'delete': case 'backspace': deleteSelected(); break;
      case 'escape': selectObj(null); break; case 'home': resetCamera(); break;
      case 't': topView(); break;
      case 'd': if (e.ctrlKey) { e.preventDefault(); duplicateSelected(); } break;
    }
  });

  window.addEventListener('resize', function() {
    var vp = document.getElementById('viewport');
    camera.aspect = vp.clientWidth / vp.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(vp.clientWidth, vp.clientHeight);
  });
}

// ==================== 动画 ====================
function animate() {
  requestAnimationFrame(animate);
  orbitControls.update();
  if (selectionBox) selectionBox.update();
  renderer.render(scene, camera);
}

// ==================== 启动 ====================
window.addEventListener('DOMContentLoaded', function() {
  init(); updateObjList();
  setStatus('就绪 | 左键旋转视角 | 左键点击选择 | 中键平移 | 滚轮缩放');
});
