import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import CannonDebugger from 'cannon-es-debugger'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
// RENDERER
const renderer = new THREE.WebGLRenderer();

renderer.setSize(window.innerWidth, window.innerHeight);

document.body.appendChild(renderer.domElement);

// SCENE
const scene = new THREE.Scene();

// CAMERA
const camera = new THREE.PerspectiveCamera(
    45,
    window.innerWidth / window.innerHeight,
    0.1,
    1000
);

// ORBIT CONTROLS
const orbit = new OrbitControls(camera, renderer.domElement);

camera.position.set(0, 20, -30);
orbit.update();

// ==============================================================
// BOX IN THREE JS
const boxGeo = new THREE.BoxGeometry(2, 2, 2);
const boxMat = new THREE.MeshBasicMaterial({
    color: 0x00ff00,
    //wireframe: true
});
const boxMesh = new THREE.Mesh(boxGeo, boxMat);
scene.add(boxMesh);

// ==============================================================
// SPHERE IN THREE JS
const sphereGeo = new THREE.SphereGeometry(2);
const sphereMat = new THREE.MeshBasicMaterial({
    color: 0xff0000,
    //wireframe: true
});
const sphereMesh = new THREE.Mesh(sphereGeo, sphereMat);
scene.add(sphereMesh);

// ==============================================================
// CYLINDER IN THREE JS
const cylinderGeo = new THREE.CylinderGeometry(1, 1, 4, 32);
const cylinderMat = new THREE.MeshBasicMaterial({
    color: 0xff00ff,
    //wireframe: true
});
const cylinderMesh = new THREE.Mesh(cylinderGeo, cylinderMat);
scene.add(cylinderMesh);

// ==============================================================
// PLANE IN THREE JS
const groundGeo = new THREE.PlaneGeometry(30, 30);
const groundMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    //wireframe: true
});
const groundMesh = new THREE.Mesh(groundGeo, groundMat);
scene.add(groundMesh);

// ==============================================================
// INITIALIZATION PHYSIC WORLD
const world = new CANNON.World({
    gravity: new CANNON.Vec3(0, -9.82, 0)
});

// ==============================================================
// PHYSIC GROUND (BOX because PLANE is INFINITE)
// Collisions depend on materials
const groundPhysMat = new CANNON.Material();

const groundBody = new CANNON.Body({
    //mass: 10,
    type: CANNON.Body.STATIC,
    //shape: new CANNON.Plane(),
    shape: new CANNON.Box(new CANNON.Vec3(15, 15, 0.1)),
    material: groundPhysMat
});
world.addBody(groundBody);
groundBody.quaternion.setFromEuler(-.5*Math.PI, 0, 0);

// ==============================================================
// BODY FOR THE BOX (PHYSIC BOX)
const boxPhysMat = new CANNON.Material();

const boxBody = new CANNON.Body({
    mass: 1,
    shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)),
    position: new CANNON.Vec3(2, 20, 0),
    material: boxPhysMat
});
world.addBody(boxBody);

// Air resistance
boxBody.linearDamping = 0.1; // [0, 1]

// Rotation of the body
boxBody.angularVelocity.set(0, 10, 0);
boxBody.angularDamping = 0.5;

// ==============================================================
// BODY FOR THE SPHERE (PHYSIC SPHERE)
const spherePhysMat = new CANNON.Material();

const sphereBody = new CANNON.Body({
    mass: 10,
    shape: new CANNON.Sphere(2),
    position: new CANNON.Vec3(0, 15, 0),
    material: spherePhysMat
});
world.addBody(sphereBody);

// Air resistance
sphereBody.linearDamping = 0.2; // [0, 1]

// ==============================================================
// BODY FOR THE CYLINDER (PHYSIC CYLINDER)
const cylinderPhysMat = new CANNON.Material();

const cylinderBody = new CANNON.Body({
    mass: 10,
    shape: new CANNON.Cylinder(1, 1, 4, 32),
    position: new CANNON.Vec3(-2, 10, 0),
    material: cylinderPhysMat
});
world.addBody(cylinderBody);

// Air resistance
cylinderBody.linearDamping = 0.5; // [0, 1]

// ==============================================================
// CONTACT BETWEEN TWO MATERIALS
const groundBoxContactMat = new CANNON.ContactMaterial(
    groundPhysMat,
    boxPhysMat,
    {friction: 0} // slippery
);

world.addContactMaterial(groundBoxContactMat);

const groundSphereContactMat = new CANNON.ContactMaterial(
    groundPhysMat,
    spherePhysMat,
    {restitution: 0.9} // bouncy
);

world.addContactMaterial(groundSphereContactMat);

const groundCylinderContactMat = new CANNON.ContactMaterial(
    groundPhysMat,
    cylinderPhysMat,
    {restitution: 0.9} // bouncy
);

world.addContactMaterial(groundCylinderContactMat);

// ==============================================================
// CANNON ES DEBUGGER

const cannonDebugger = new CannonDebugger(scene, world);

// ==============================================================
// ANIMATION

const timeStep = 1 / 60;

function animate() {
    world.step(timeStep);

    groundMesh.position.copy(groundBody.position);
    groundMesh.quaternion.copy(groundBody.quaternion);

    boxMesh.position.copy(boxBody.position);
    boxMesh.quaternion.copy(boxBody.quaternion);

    sphereMesh.position.copy(sphereBody.position);
    sphereMesh.quaternion.copy(sphereBody.quaternion);

    cylinderMesh.position.copy(cylinderBody.position);
    cylinderMesh.quaternion.copy(cylinderBody.quaternion);

    cannonDebugger.update();

    renderer.render(scene, camera);
}

renderer.setAnimationLoop(animate);

window.addEventListener('resize', function() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});