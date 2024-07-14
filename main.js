import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import * as dat from 'dat.gui';
import CannonDebugger from 'cannon-es-debugger'
import WebGL from 'three/examples/jsm/capabilities/WebGL.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// VARIABLES DECLARATION
// Three.js main variables
var scene, camera, renderer;
// Player with its attributes
var player = {height: 1.8, speed: 0.2, fast: 0, turnSpeed: Math.PI * 0.01, maxBullets: 10, canJump: true, startJump: 0, coins: 30, color: 0xffc000};
// Player body in cannon
var playerBody;
// Loader for 3D models, loading manager
var loader, loadingManager;
// Controls
var datGUI, keyboard = {};
// Raycaster
var raycaster, selected, showWin, pickableObjects = [];
// Helpers
// var cannonDebugger;
// Physic World
var world, timeStep;
// Objects array (mesh + body for each object)
var obstacles = [], bullets = [], grenades = [], crates = [], gems = [];
// Guns with their attributes
var medium_gun = {price: 5, bought: false, lock: null, texture: null};
var big_gun = {price: 20, bought: false, lock: null, texture: null};
// Robot
var robotMesh, robotBody;
// Collisions
var floorPhysMat, wallPhysMat, bulletPhysMat, robotPhysMat, targetPhysMat, grenadePhysMat, cratePhysMat;

// Collisions groups: assign each object to one of the group and then filter the collisions between groups
var GROUP_OBJECTS = 1;
var GROUP_BULLETS = 2;
var GROUP_PLAYER = 4;

// Loading screen: render this mock scene while waiting the loader
var RESOURCES_LOADED = false;

var loadingScreen = {
    scene: new THREE.Scene(),
    camera: new THREE.PerspectiveCamera(
        75, 
        window.innerWidth / window.innerHeight,
        0.1,
        100
    )
}

init();

function init() {

    //===================================================================
    // INITIALIZING THREE.JS

    // Scene: set up what you want to render and where
    scene = new THREE.Scene();

    // Camera: create a camera like the human oint of view, set
    // the field of view, the aspect ratio and the near/far plane,
    // so define the area you want to look at
    camera = new THREE.PerspectiveCamera(
        75,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    // Set the initial position of the camera 
    camera.position.set(0, player.height, 30);
    // Look (point the camera) slightly above the origin of the scene
    camera.lookAt(0, player.height, 0);
    // Invert rotation axis of the camera to handle rotaion through mouse movement
    camera.rotation.order = 'YXZ';

    // Renderer: used to display the scene {without polishing}
    renderer = new THREE.WebGLRenderer({antialias: false});
    // Fill the entire window, set color to black
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000);
    renderer.setPixelRatio(window.devicePixelRatio);
    // Enable shadows display
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Raycaster: picks whatever object the mouse is over
    raycaster = new THREE.Raycaster();

    //===================================================================
    // SETTING THE LIGHTS

    // Ambient Light: illuminates everything, doesn't cast shadows
    var ambientLight = new THREE.AmbientLight(0x555555, 2)
    scene.add(ambientLight);

    // Directional Light: parallel rays from an origin towards a specific direction
    // Default target is the origin: direction is calculated from position to the origin to cast shadows
    var directionalLight = new THREE.DirectionalLight(0xffffff, 1);
    directionalLight.position.set(-50, 100, 20);
    directionalLight.castShadow = true;
    // Sharper shadows with higher resolution
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    // Area of effect: directional light is infinite, specify the area to cover
    // Its like shaping the frustum of the light rays
    directionalLight.shadow.camera.near = 0.1;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    scene.add(directionalLight);

    // RectArea Light: uniform light from a rectangular plane
    // I use that to illuminate the area of the guns
    var gunLight = new THREE.RectAreaLight(0xffffff, 10, 6, 10);
    gunLight.position.set(40, 5, 0);
    gunLight.lookAt(40, 0, 0);
    scene.add(gunLight);

    //===================================================================
    // ADDING CONTROLS FOR THE LIGHTS

    // Interface to interact with and modify some parameters of the scene
    datGUI = new dat.GUI();

    // Ambient Light parameters
    var ambientLightFolder = datGUI.addFolder('Ambient Light');
    // Range of possible values on the GUI
    ambientLightFolder.add(ambientLight, 'intensity', 0.01, 10);
    ambientLightFolder.add(ambientLight.color, 'r', 0, 1);
    ambientLightFolder.add(ambientLight.color, 'g', 0, 1);
    ambientLightFolder.add(ambientLight.color, 'b', 0, 1);
    ambientLightFolder.open();

    // Directional Light parameters
    var directionalLightFolder = datGUI.addFolder('Directional Light');
    // Range of possible values on the GUI
    directionalLightFolder.add(directionalLight.position, 'x', -100, 100);
    directionalLightFolder.add(directionalLight.position, 'y', 0, 200);
    directionalLightFolder.add(directionalLight.position, 'z', -100, 100);
    directionalLightFolder.add(directionalLight, 'intensity', 0.01, 10);
    directionalLightFolder.open();

    //===================================================================
    // INITIALIZING THE PHYSIC WORLD

    // Create a physics world with gravity
    world = new CANNON.World({
        // Gravity Force
        gravity: new CANNON.Vec3(0, -9.82, 0)
    });

    // Set the timestep of the simulation (so the fps - frame per second)
    timeStep = 1 / (60 * 1.5);

    //===================================================================
    // CANNON-ES-DEBUGGER

    //cannonDebugger = new CannonDebugger(scene, world);

    //===================================================================
    // BUILDING THE SCENE

    // Create both the meshes and the bodies of floor and walls 
    // Also create the invisible planes to insert text
    buildRoom();
    // Randomly reate both the meshes and the bodies of the obstacles
    // between the enemy and the falling zone
    buildObstacles();

    //===================================================================
    // BODY OF THE PLAYER

    // Create a physic body for the player, around the position of the camera
    // I need this to create a real body for the player, moving with the camera,
    // to be able to handle collisions with other bodies
    var playerPhysMat = new CANNON.Material();

    // I define a parallelepiped as body shape, because it is a sufficient approximation
    // of the actual body of a character in the game. I could use a capsule, but collisions
    // for complex shapes are not totally implemented in cannon-es as in the documentation
    playerBody = new CANNON.Body({
        mass: 70,
        shape: new CANNON.Box(new CANNON.Vec3(0.5, 1, 0.5)),
        position: new CANNON.Vec3(camera.position.x, 2, camera.position.z),
        material: playerPhysMat,
        // I filter the collisions experienced by the box body of the player:
        // he can collide only with other objects, but not with himself (there are no other players)
        // nor with bullets
        collisionFilterGroup: GROUP_PLAYER,
        collisionFilterMask: GROUP_OBJECTS
    });
    // I want the body of the player to effectively collide with other bodies, but I don't want
    // this collisions to cause the box to fall or to rotate, so I fix the rotation.
    // In this way the box can be blocked or bounce back, but I don't have the problem
    // of the box horizontally falling down
    playerBody.fixedRotation = true;
    playerBody.updateMassProperties();
    world.addBody(playerBody);

    // I define the behavior of the box and the floor colliding to avoid sliding on the floor
    // and bouncing too much. Other collisions are good as they are on default
    const playerFloorContactMat = new CANNON.ContactMaterial(
        playerPhysMat,
        floorPhysMat,
        {restitution: 0},
        {friction: 0}
    );

    world.addContactMaterial(playerFloorContactMat);

    //===================================================================
    // LOADING OBJECTS

    // I use a loading manager to wait for all the objects to be loaded
    // before rendering the scene
    loadingManager = new THREE.LoadingManager();

    // Print on the console each item that has been loaded
    loadingManager.onProgress = function(item, loaded, total) {
        console.log(item, loaded, total);
    }

    // When all the items are correctly loaded, I turn the variable
    // to True, to allow the animation and the rendering to start
    loadingManager.onLoad = function() {
        console.log("All resources loaded.");
        RESOURCES_LOADED = true;
    }

    // Loader to import external glTF 3D models
    loader = new GLTFLoader(loadingManager);

    // Load the guns models for the shop
    loadGuns();

    // Load the target model for the training zone
    loadTraining();

    // Load the grenades models to build the pyramid
    loadPyramid();

    // Load the creates models for the spinning area
    loadSpin();

    // Load the enemy model
    spawnEnemy();
    
    //===================================================================
    // RENDERING THE SCENE

    // Write on the screen the starting amount of coins
    document.getElementById("coins").innerHTML = player.coins;

    // Display the scene adding a <canvas> element to the HTML
    document.body.appendChild(renderer.domElement);

    // Be sure the device and the browser support WebGL
    if (WebGL.isWebGLAvailable()) {
        // Display the scene and start the animation loop
        animate();
    } else {
        const warning = WebGL.getWebGLErrorMessage();
        document.getElementById('container').appendChild(warning);
    }

}

// Outside the main function, handle user inputs and define functions

//===================================================================
// KEYS LISTENER

// Keyup: what to do when a key is released
window.addEventListener('keyup', function(event) {
    // If the player (pressed and) released the space key, he wants to shot a bullet
    if (event.code === 'Space') shootBullet();
    // If the player released the R key, he wants to reload his guns
    else if (event.code === 'KeyR') {
        // To give the impression of reloading over time I just show an html div
        // with the write "Reloading" and I wait a second to execute the reloading function
        document.getElementById('reloading').style.visibility = "visible";
        setTimeout(reloadGuns, 1000);
    }
    else {
        // For each other key, put False in the dictionary: that key is not pressed
        keyboard[event.code] = false;
    }
});

// Keydown: what to do when a key is pressed
window.addEventListener('keydown', function(event) {
    // Set the value of that key code in the dictionary to True: that key is pressed
    keyboard[event.code] = true;
});

// Click: what to do when the user clicks with the left button of its mouse
window.addEventListener('click', onMouseClick, false);

function onMouseClick(event) {
    // Prevent default behavior of the click
    event.preventDefault();

    // After clicking, both tutorial and pause menu must be hidden
    document.getElementById("tutorial").style.visibility = "hidden";
    document.getElementById("pause").style.visibility = "hidden";

    // If you click while your pointer is already locked
    if (document.pointerLockElement === document.body) {

        // Update the raycaster with the camera and the direction it is looking at
        raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));

        // Calculate objects intersecting the ray originated from the camera and following the looking direction
        // Pick such objects only if they are inside the list of pickableObjects (guns, buttons)
        var intersects = raycaster.intersectObjects(pickableObjects, true);

        // Reset the position of all pickable objects besides the selected one (current gun)
        pickableObjects.forEach(obj => {
            if (obj != selected) obj.position.y = 1
        });

        // If there's an intersection, take the first intersected object
        if (intersects.length > 0) {
            var intersectedObject = intersects[0].object;

            // Loaded models can be a combination of different meshes,
            // but I want to select the whole object and not only a part with raycasting
            // Traverse up to the biggest parent of the intersected object unless it is the scene itself
            while (intersectedObject.parent && intersectedObject.parent.type !== 'Scene') {
                intersectedObject = intersectedObject.parent;
            }

            // I compute the distance on x and z axis between the player and the picked object,
            // to select them only if the player is near enough and not across the map
            var distancex = intersectedObject.position.x - playerBody.position.x;
            var distancez = intersectedObject.position.z - playerBody.position.z;
            
            // If the player is near enough and clicked on an object different from the selected gun
            if (intersectedObject != selected && distancex <= 15 && distancez <= 15) {

                switch(intersectedObject.name) {
                    // If he clicked on the little gun
                    case 'littleGun':
                        // Show the shadow of the little gun and hide the others
                        document.getElementById("pistol").style.visibility = "visible";
                        document.getElementById("rifle").style.visibility = "hidden";
                        document.getElementById("grenade").style.visibility = "hidden";
                        // Lift the model of the little gun
                        intersectedObject.position.y += 2;
                        // Update the selected gun variable
                        selected = intersectedObject;
                        // Reset the position of all the other objects
                        pickableObjects.forEach(obj => {
                            if (obj != selected) obj.position.y = 1;
                        });
                        break;
                    // If he clicked on the medium gun
                    case 'mediumGun':
                        // This gun needs to be bought
                        // If the player has not bought the gun yet and has enough money
                        if (medium_gun.bought == false && player.coins >= medium_gun.price) {
                            // Subtract the money spent by the player from his coins
                            player.coins -= medium_gun.price;
                            // Update the coins shown on screen
                            document.getElementById("coins").innerHTML = player.coins;
                            // Remove the lock and the price from the scene
                            scene.remove(medium_gun.lock);
                            scene.remove(medium_gun.texture);
                            // The player has now bought the gun
                            medium_gun.bought = true;
                        }
                        // If the player already owns the gun
                        if (medium_gun.bought == true) {
                            // Show the shadow of the medium gun and hide the others
                            document.getElementById("pistol").style.visibility = "hidden";
                            document.getElementById("rifle").style.visibility = "visible";
                            document.getElementById("grenade").style.visibility = "hidden";
                            // Lift the model of the medium gun
                            intersectedObject.position.y += 2;
                            // Update the selected gun variable
                            selected = intersectedObject;
                            // Reset the position of all the other objects
                            pickableObjects.forEach(obj => {
                                if (obj != selected) obj.position.y = 1;
                            });
                        }
                        break;
                    // If he clicked on the big gun
                    case 'bigGun':
                        // This gun needs to be bought
                        // If the player has not bought the gun yet and has enough money
                        if (big_gun.bought == false && player.coins >= big_gun.price) {
                            // Subtract the money spent by the player from his coins
                            player.coins -= big_gun.price;
                            // Update the coins shown on screen
                            document.getElementById("coins").innerHTML = player.coins;
                            // Remove the lock and the price from the scene
                            scene.remove(big_gun.lock);
                            scene.remove(big_gun.texture);
                            // The player has now bought the gun
                            big_gun.bought = true;
                        }
                        // If the player already owns the gun
                        if (big_gun.bought == true) {
                            // Show the shadow of the big gun and hide the others
                            document.getElementById("pistol").style.visibility = "hidden";
                            document.getElementById("rifle").style.visibility = "hidden";
                            document.getElementById("grenade").style.visibility = "visible";
                            // Lift the model of the big gun
                            intersectedObject.position.y += 2;
                            // Update the selected gun variable
                            selected = intersectedObject;
                            // Reset the position of all the other objects
                            pickableObjects.forEach(obj => {
                                if (obj != selected) obj.position.y = 1;
                            });
                        }
                        break;
                    // If he clicked on the yellow button
                    case 'button':
                        // Remove all the grenades from the scene and from the physics world
                        while(grenades.length > 0) {
                            let g = grenades.pop();
                            scene.remove(g.mesh);
                            world.removeBody(g.body);
                        }
                        // Reload the pyramid of grenades
                        loadPyramid();
                        break;
                }
            }

        }

        // CRATE SPINNING
        // Launch enother ray from the position of the camera to the direction it is looking at
        raycaster.set(camera.position, camera.getWorldDirection(new THREE.Vector3()));

        // Calculate objects intersecting the picking ray, this time with the set of crates
        var intersects = raycaster.intersectObjects(crates, true);

        // If at least a mesh of the crates has been intersected by the ray
        if (intersects.length > 0) {

            // Take the first intersected object
            var intersectedObject = intersects[0].object;
            // Go up from the mesh to the entire crate model
            while (intersectedObject.parent && intersectedObject.parent.type !== 'Scene') {
                intersectedObject = intersectedObject.parent;
            }

            // Compute the distance between the body of the player and the position of the intersected crate
            var distancex = intersectedObject.position.x - playerBody.position.x;
            var distancez = intersectedObject.position.z - playerBody.position.z;

            // If the player is near enough
            if (distancex <= 20 && distancez <= 20) {
                // I will generate the convex polyhedron only if the player
                // was able to activate one of the crates
                var through = false;
                var convexGeo;
                
                // Pick a random color between the 4 pre determined
                var pickColor = Math.random();
                var color;
                if (pickColor <= 0.4) color = 0xffc000;
                else if (pickColor <= 0.7) color = 0x1ff2ff;
                else if (pickColor <= 0.9) color = 0x00ff00;
                else color = 0xe4a0f7;

                switch(intersectedObject.name) {
                    // If the player selected the 1 coin crate
                    case '1coin':
                        // If he doesn't have enough coins leave the switch
                        if (player.coins < 1) break;
                        // If he has enough coins he activates the crate
                        through = true;
                        // Subtract the paid coins from its own
                        player.coins -= 1;
                        // Update the player coins on screen
                        document.getElementById("coins").innerHTML = player.coins;
                        // Change the color of the player bullets
                        player.color = color;

                        // Set the geomtry of the convex polygon to icosahedron (20 faces)
                        convexGeo = new THREE.IcosahedronGeometry(0.5); 

                        break;
                    // If the player selected the 2 coins crate
                    case '2coins':
                        // If he doesn't have enough coins leave the switch
                        if (player.coins < 2) break;
                        // If he has enough coins he activates the crate
                        through = true;
                        // Subtract the paid coins from its own
                        player.coins -= 2;
                        // Update the player coins on screen
                        document.getElementById("coins").innerHTML = player.coins;
                        // Fix the color to black
                        color = 0x000000;

                        // Increase the maximum number of bullets by one
                        player.maxBullets += 1;
                        // Reload the guns
                        reloadGuns();

                        // Set the geometry of the convex polyhedron to octahedron (8 faces)
                        convexGeo = new THREE.OctahedronGeometry(0.5); 
                        
                        break;
                    // If the player selected the 5 coins crate
                    case '5coins':
                        // If he doesn't have enough coins leave the switch
                        if (player.coins < 5) break;
                        // If he has enough coins he activates the crate
                        through = true;
                        // Subtract the paid coins from its hown
                        player.coins -= 5;
                        // Update the player coins on screen
                        document.getElementById("coins").innerHTML = player.coins;

                        // Set the geometry of the convex polyhedron to dodecahedron (12 faces)
                        convexGeo = new THREE.DodecahedronGeometry(0.5); 

                        // Generate a random integer win between 0 and 5
                        var win = Math.floor(Math.random() * 5);

                        // The random color reflects the probability of increasing the win
                        if (pickColor <= 0.4) {
                            // 40% probability of losing coins
                            document.getElementById("win").innerHTML = "(+0)";
                        }
                        if (pickColor > 0.4 && pickColor <= 0.7) {
                            // 30% probability of winning 0 - 5 coins
                            player.coins += win;
                            document.getElementById("win").innerHTML = "(+" + win + ")";
                        }
                        if (pickColor > 0.7 && pickColor <= 0.9) {
                            // 20% probability of winning up to 10 coins
                            player.coins += win*2;
                            document.getElementById("win").innerHTML = "(+" + win*2 + ")";
                        }
                        if (pickColor > 0.9) {
                            // 10% probability of winning up to 25 coins
                            player.coins += win*5;
                            document.getElementById("win").innerHTML = "(+" + win*5 + ")";
                        }
                        // Update the player coins on screen
                        document.getElementById("coins").innerHTML = player.coins;
                        
                        break;
                }

                // If the player activates one of the crates, the polyhedron is generated 
                if (through) {
                    // The color is the random one (or Black if the crates is the 2 coins one)
                    // The geometry is given by the crate
                    var convexMat = new THREE.MeshStandardMaterial({color: color});
                    var convexMesh= new THREE.Mesh(convexGeo, convexMat);
                    // Allow the polyhedron to cast and receive shadows
                    convexMesh.castShadow = true;
                    convexMesh.receiveShadow = true;
                    // Add the polyhedron to the scene
                    scene.add(convexMesh);

                    // Extract vertices from the geometry
                    // Remove unnecessary attributes
                    convexGeo.deleteAttribute('normal');
                    convexGeo.deleteAttribute('uv');
                    // Merge duplicate vertices
                    convexGeo = BufferGeometryUtils.mergeVertices(convexGeo);

                    var vertices = [];
                    // For each vertex of the geometry, take the position and add to the array
                    for (let i = 0; i < convexGeo.attributes.position.count; i++) {
                        vertices.push(
                            new CANNON.Vec3(
                                convexGeo.attributes.position.getX(i),
                                convexGeo.attributes.position.getY(i),
                                convexGeo.attributes.position.getZ(i)
                            )
                        );
                    }

                    // Extract faces from the geometry
                    var faces = [];
                    // For each three indices create a triangle and add to the faces array
                    for (let i = 0; i < convexGeo.index.count; i += 3) {
                        faces.push([
                            convexGeo.index.getX(i),
                            convexGeo.index.getX(i + 1),
                            convexGeo.index.getX(i + 2)
                        ]);
                    }
                    
                    // Create a ConvexPolyhedron shape from the vertices and faces
                    var convexShape = new CANNON.ConvexPolyhedron({
                        vertices: vertices,
                        faces: faces
                    });

                    // Create a convex body for the polyhedron, based on the shape
                    var convexBody = new CANNON.Body({
                        mass: 1,
                        shape: convexShape
                    });
                    // Position the body of the polyhedron slightly above the crate the player spinned
                    convexBody.position.set(
                        intersectedObject.position.x,
                        intersectedObject.position.y + 3,
                        intersectedObject.position.z
                    );
                    // Randomly set horizontal speed for the polyhedron
                    var speedx = Math.random() * -3;
                    var speedz = Math.random() * 3;
                    var chance = Math.random();
                    if (chance > 0.5) speedz *= -1;
                    // Assign the velocity to the polyhedron body and add that to the world,
                    // so that he will start moving with the generated speed
                    convexBody.velocity.set(speedx, 10, speedz);
                    convexBody.angularVelocity.set(speedx, 0, speedz);
                    world.addBody(convexBody);

                    // Now that the polyhedron is created, save both the mesh and the body in array
                    gems.push({mesh: convexMesh, body: convexBody});
                    // Save the mesh of the last launched polyhedron in a variable to handle
                    // the text of the won coins
                    showWin = convexMesh;
                }
            }
        }
    } else {
        // If you click while your pointer is not locked, request the lock
        document.body.requestPointerLock();
    }
}

// Don't request pointer lock if you interact with dat GUI
datGUI.domElement.addEventListener('click', function(event) {
    event.stopPropagation();
});

// Mousemove: what to do when the mouse moves on the screen
document.body.addEventListener('mousemove', (event) => {
    // If the pointer is already locked
    if (document.pointerLockElement === document.body) {

        // Rotate the camera w.r.t. how much the mouse moved
        camera.rotation.y -= event.movementX / 500;
        camera.rotation.x -= event.movementY / 500;

        // Prevent vertical flipping: you can rotate only up to 90 degrees and down to -90 degrees
        const maxVerticalRotation = Math.PI / 2;
        const minVerticalRotation = -Math.PI / 2;

        camera.rotation.x = Math.max(minVerticalRotation, Math.min(maxVerticalRotation, camera.rotation.x));

    }

} );

// Pointerlockchange: what to do when the pointer is locked / unlocked
document.addEventListener('pointerlockchange', function() {
    if (document.pointerLockElement === document.body) {
        // If the pointer is locked, hide the pause menu
        document.getElementById("pause").style.visibility = "hidden";
    } else {
        // If the pointer is unlocked, show the pause menu
        document.getElementById("pause").style.visibility = "visible";
    }
});

//===================================================================
// ANIMATE FUNCTION

function animate() {
    // While the resources are not loaded, keep rendering a loadingScreen scene
    // waiting for the loader to complete (setting the variable to True)
    if (RESOURCES_LOADED == false) {
        requestAnimationFrame(animate);
        renderer.render(loadingScreen.scene, loadingScreen.camera);
        return;
    }

    // Loop and keep things up to date
    requestAnimationFrame(animate);
    // Set time between updates
    world.step(timeStep);
    // Update position and quaternion of objects w.r.t. their body
    updatePhysics();
    // Move the player (camera + playerBody)
    playerMovement();
    // Handle robot movement (enemy)
    robotMovement();
    // Update cannon-es-debugger
    //cannonDebugger.update();
    // Rotate guns in the shop and the button
    pickableObjects.forEach( (gun) => {
        gun.rotation.y += 0.01;
    });
    // Actually render the scene
    renderer.render(scene, camera);
}

//===================================================================
// UPDATE PHYSICS FUNCTION

function updatePhysics() {
    // Bullets: let the meshes copy the bodies
    bullets.forEach((bullet) => {
        bullet.mesh.position.copy(bullet.body.position);
        bullet.mesh.quaternion.copy(bullet.body.quaternion);
    });
    // Camera: let the camera move with the player body
    camera.position.x = playerBody.position.x;
    camera.position.y = playerBody.position.y + 1;
    camera.position.z = playerBody.position.z;
    // Obstacles: make obstacles oscillating around their z value
    obstacles.forEach((obs, index) => {
        var phase = index * 0.5;
        obs.body.position.z = obs.z + Math.sin(Date.now() * 0.001 + phase) * 4;
        obs.mesh.position.copy(obs.body.position);
        obs.mesh.quaternion.copy(obs.body.quaternion);
    });
    // Robot: let the mesh copy the body
    robotMesh.position.copy(robotBody.position);
    robotMesh.quaternion.copy(robotBody.quaternion);
    // Grenades: let the meshes copy the bodies
    grenades.forEach((nade) => {
        nade.mesh.position.copy(nade.body.position);
        nade.mesh.quaternion.copy(nade.body.quaternion);
    });
    // Gems: when the last gem is about to touch the floor,
    // remove the amount of won coins from the screen
    gems.forEach((gem) => {
        gem.mesh.position.copy(gem.body.position);
        gem.mesh.quaternion.copy(gem.body.quaternion);
        if (gem.mesh == showWin && gem.body.position.y < 0.5) {
            document.getElementById("win").innerHTML = "";
            showWin = null;
        }
    });
}

//===================================================================
// RESIZING THE RENDERED SCENE WHEN RESIZING THE WINDOW
// Resize: what to do when the screen is resized
window.addEventListener('resize', function() {
    // Update the camera aspect ratio to the new sizes
    camera.aspect = window.innerWidth / this.window.innerHeight;
    // Update projection matrix to project the scene in the screen with
    // the same proportions with the new aspect ratio
    camera.updateProjectionMatrix();
    // Set again the renderer
    renderer.setSize(window.innerWidth, window.innerHeight);
});

//===================================================================
// PLAYER MOVEMENT FUNCTION
// This function is always executed in the animation loop 
function playerMovement() {
    player.fast = 0;
    // If E key is pressed the player will jump
    if (keyboard["KeyE"] && player.canJump) {
        player.startJump = playerBody.position.y;
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        // Set player velocity upward: he will start going up
        playerBody.velocity.y = 30;
        // When the player jump he can't jump again before landing
        player.canJump = false;
    }
    // If W key is pressed the player will walk forward
    if (keyboard["KeyW"]) {
        // Move the player body forward as the W key is pressed
        // Aldo diagonal movement is handled
        // The velocity is doubled if the shift button is pressed
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.position.x -= Math.sin(camera.rotation.y) * player.fast;
        playerBody.position.z += -Math.cos(camera.rotation.y) * player.fast;
    }
    // If A key is pressed the player will walk leftward
    if (keyboard["KeyA"]) {
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.position.x -= Math.sin(camera.rotation.y + Math.PI/2) * player.fast;
        playerBody.position.z += -Math.cos(camera.rotation.y + Math.PI/2) * player.fast;
    }
    // If S key is pressed the player will walk backward
    if (keyboard["KeyS"]) {
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.position.x += Math.sin(camera.rotation.y) * player.fast;
        playerBody.position.z -= -Math.cos(camera.rotation.y) * player.fast;
    }
    // If R key is pressed the player will walk rightward
    if (keyboard["KeyD"]) {
        player.fast = player.speed;
        if (keyboard["ShiftLeft"] || keyboard["ShiftRight"]) player.fast *= 2;
        playerBody.position.x -= Math.sin(camera.rotation.y - Math.PI/2) * player.fast;
        playerBody.position.z += -Math.cos(camera.rotation.y - Math.PI/2) * player.fast;
    }
    // If the player fall off the plane, he is teleported back to spawn point
    if (playerBody.position.y < -10) {
        playerBody.position.set(0, 5, 30);
    }
    // If the player vertical velocity is almost 0, he can jump again
    if (Math.abs(playerBody.velocity.y) < 0.1) {
        player.canJump = true;
        player.startJump = 0;
    }
    // Once the player reaches a certain height from the jumping point,
    // its velocity is mitigated to have a soft landing
    if (playerBody.position.y - player.startJump >= 6) {
        playerBody.velocity.y = -10;
    }
}

//===================================================================
// MOVEMENT FUNCTION

function robotMovement() {
    // You kill the robot if you shoot him off the plane
    if (robotBody.position.y < -10) {
        // When the player fall off the plane, remove him from the scene and the world
        scene.remove(robotMesh);
        world.removeBody(robotBody);
        // Killing the robot grants the player 1 coin
        player.coins += 1;
        document.getElementById("coins").innerHTML = player.coins;
        // Spawn again the enemy 
        spawnEnemy();
        // Teleport back the player
        playerBody.position.set(0, 5, 30);

        // Once the robot is dead, remove all the obstacles from the scene and the world
        while (obstacles.length > 0) {
            let o = obstacles.pop();
            scene.remove(o.mesh);
            world.removeBody(o.body);
        }
        // Generate a new set of random obstacles
        buildObstacles();

        // Once the robot is dead, remove all the grenades from the scene and the world
        while(grenades.length > 0) {
            let g = grenades.pop();
            scene.remove(g.mesh);
            world.removeBody(g.body);
        }
        // Load again the pyramid of grenades
        loadPyramid();

        // Once the robot is dead, remove all the gems from the scene and the world
        while(gems.length > 0) {
            let g = gems.pop();
            scene.remove(g.mesh);
            world.removeBody(g.body);
        }
    }
}

//===================================================================
// BUILDING ROOM FUNCTION
function buildRoom() {

    // Plane in Three.js to build the floor
    var floorGeo = new THREE.PlaneGeometry(100, 100);
    // Texture of the floor from a png image (color gradient)
    var texture = new THREE.TextureLoader(loadingManager).load('images/floor.png');
    var floorMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        map: texture,
        side: THREE.DoubleSide,
        //wireframe: true
    });
    // Building the floor
    var floorMesh = new THREE.Mesh(floorGeo, floorMat);
    // Rotation to make the floor horizontal
    floorMesh.rotation.set(-.5*Math.PI, 0, 0);
    // Shadows: the floor doesn't cast shadows, only receives
    floorMesh.castShadow = false;
    floorMesh.receiveShadow = true;
    scene.add(floorMesh);

    // Body for the floor
    // Collisions depend on involved materials
    floorPhysMat = new CANNON.Material();

    var floorBody = new CANNON.Body({
        // Static, it has mass: 0
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(50, 50, 1)),
        material: floorPhysMat,
        // The floor can collide with everything
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
    // I need to rotate the plan to make it a floor
    floorBody.quaternion.setFromEuler(-.5*Math.PI, 0, 0);
    floorBody.position.set(0, -1, 0);
    world.addBody(floorBody);

    // Walls
    var wallGeo = new THREE.PlaneGeometry(100, 20);
    var texture = new THREE.TextureLoader(loadingManager).load('images/wall.png');
    var wallMat = new THREE.MeshPhongMaterial({
        color: 0xffffff,
        map: texture,
        side: THREE.DoubleSide
    });

    wallPhysMat = new CANNON.Material();

    // First wall
    var wall1Mesh = new THREE.Mesh(wallGeo, wallMat);
    wall1Mesh.position.set(0, 10, -50);
    wall1Mesh.castShadow = false;
    wall1Mesh.receiveShadow = true;
    scene.add(wall1Mesh);

    var wall1Body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(50, 10, 1)),
        material: wallPhysMat,
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
    wall1Body.position.set(0, 10, -51);
    world.addBody(wall1Body);

    // Label: to give a name to each area of the map I used some little 
    // planes with special textures, png images of some text without background
    // Making the plane transparent allows to see ony the 2D written text
    // Fight label
    var labelGeo = new THREE.PlaneGeometry(15, 6);
    var texture = new THREE.TextureLoader(loadingManager).load('images/fight.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x00bdc8,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    var fight = new THREE.Mesh(labelGeo, labelMat);
    fight.position.set(0, 12, -45);
    fight.castShadow = false;
    fight.receiveShadow = true;
    scene.add(fight);

    // Second wall
    var wall2Mesh = new THREE.Mesh(wallGeo, wallMat);
    wall2Mesh.position.set(50, 10, 0);
    wall2Mesh.rotation.set(0, -.5*Math.PI, 0);
    wall2Mesh.castShadow = false;
    wall2Mesh.receiveShadow = true;
    scene.add(wall2Mesh);

    var wall2Body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(50, 10, 1)),
        material: wallPhysMat,
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
    wall2Body.quaternion.setFromEuler(0, -.5*Math.PI, 0);
    wall2Body.position.set(51, 10, 0);
    world.addBody(wall2Body);

    // Shop label
    var labelGeo = new THREE.PlaneGeometry(15, 6);
    var texture = new THREE.TextureLoader(loadingManager).load('images/shop.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x00bdc8,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    var shop = new THREE.Mesh(labelGeo, labelMat);
    shop.rotation.set(0, -.5*Math.PI, 0);
    shop.position.set(45, 12, 0);
    shop.castShadow = false;
    shop.receiveShadow = true;
    scene.add(shop);

    // First Corner
    // Training label
    var labelGeo = new THREE.PlaneGeometry(25, 8);
    var texture = new THREE.TextureLoader(loadingManager).load('images/training.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x00bdc8,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    var training = new THREE.Mesh(labelGeo, labelMat);
    training.rotation.set(0, -.25*Math.PI, 0);
    training.position.set(40, 20, -40);
    training.castShadow = false;
    training.receiveShadow = true;
    scene.add(training);

    // Third Wall
    var wall3Mesh = new THREE.Mesh(wallGeo, wallMat);
    wall3Mesh.position.set(0, 10, 50);
    wall3Mesh.castShadow = false;
    wall3Mesh.receiveShadow = true;
    scene.add(wall3Mesh);

    var wall3Body = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(50, 10, 1)),
        material: wallPhysMat,
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
    wall3Body.position.set(0, 10, 51);
    world.addBody(wall3Body);

    // Fight label (on the specular wall)
    var labelGeo = new THREE.PlaneGeometry(15, 6);
    var texture = new THREE.TextureLoader(loadingManager).load('images/fight.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x00bdc8,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    var fight = new THREE.Mesh(labelGeo, labelMat);
    fight.position.set(0, 12, 45);
    fight.rotation.set(0, Math.PI, 0);
    fight.castShadow = false;
    fight.receiveShadow = true;
    scene.add(fight);

    // Second Corner
    // Spin label
    var labelGeo = new THREE.PlaneGeometry(15, 6);
    var texture = new THREE.TextureLoader(loadingManager).load('images/spin.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x00bdc8,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    var spin = new THREE.Mesh(labelGeo, labelMat);
    spin.rotation.set(0, -.75*Math.PI, 0);
    spin.position.set(42, 20, 42);
    spin.castShadow = false;
    spin.receiveShadow = true;
    scene.add(spin);
}

//===================================================================
// OBSTACLES BUILDING FUNCTION

function buildObstacles() {
    var obsHeight;
    // The area containing the obstacles is on the left side of the room
    for (let i = -44; i <= -20; i += 12) {
        for (let j = -40; j <= 40; j += 20) {
            // Randomly generate the height of the obstacles between 0 - 10
            obsHeight = Math.random() * 10;
            // Create a box mesh with the generated height and fixed x,z
            var boxGeo = new THREE.BoxGeometry(5, obsHeight, 5);
            var boxMat = new THREE.MeshBasicMaterial({
                color: 0xffffff
            });
            var boxMesh = new THREE.Mesh(boxGeo, boxMat);
            // Obstacles have predefined positions
            boxMesh.position.set(i, obsHeight/2, j);
            boxMesh.castShadow = true;
            boxMesh.receiveShadow = true;
            scene.add(boxMesh);

            // Body for the obstacle (physics box)
            var boxBody = new CANNON.Body({
                type: CANNON.Body.STATIC,
                shape: new CANNON.Box(new CANNON.Vec3(2.5, obsHeight/2, 2.5)),
                position: new CANNON.Vec3(i, obsHeight/2, j),
                material: wallPhysMat,
                // An obstacle can collide with everything
                collisionFilterGroup: GROUP_OBJECTS,
                collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
            });
            world.addBody(boxBody);

            // Keep track of each generated obstacle in an array
            obstacles.push({
                mesh: boxMesh, 
                body: boxBody,
                // Save z value to handle movement
                z: j
            });
        }
    }
}

//===================================================================
// ENEMY SPAWN FUNCTION
function spawnEnemy() {
    // Load the model of the enemy
    loader.load('models/botDrone.gltf', function(gltf) {
        robotMesh = gltf.scene;
        // For each mesh of the object, allow shadows
        robotMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        robotMesh.scale.set(2, 2, 2);
        robotMesh.name = 'robot';
        scene.add(robotMesh);
    }, undefined, function(error) {
        console.error(error);
    });

    // Create a body for the enemy
    robotPhysMat = new CANNON.Material();
    // Give to the enemy the shape of a sphere
    robotBody = new CANNON.Body({
        mass: 20,
        shape: new CANNON.Sphere(2.5),
        position: new CANNON.Vec3(-2, 5, 0),
        material: robotPhysMat
    });
    robotBody.quaternion.setFromEuler(0, .9*Math.PI, 0);
    world.addBody(robotBody);

    // Air resistance
    robotBody.linearDamping = 0.2; // [0, 1]
}

//===================================================================
// GUNS LOADING FUNCTION
function loadGuns() {
    // Define the geometry for the boxes at the base of the guns
    var gunBoxGeo = new THREE.BoxGeometry(2, 0.3, 2);
    var gunBoxMat = new THREE.MeshBasicMaterial({
        color: 0xffc000,
        //wireframe: true
    });

    //=================================================
    // BIG GUN
    // Load the big gun
    loader.load('models/bigGun.gltf', function(gltf) {
        var gun = gltf.scene;
        gun.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        // Add the gun to the pickable items
        pickableObjects.push(gun);
        gun.position.set(40, 1, -5);
        gun.scale.set(3, 3, 3);
        // Give the gun a name to use in the raycaster switch
        gun.name = 'bigGun';
        scene.add(gun);
    }, undefined, function(error) {
        console.error(error);
    });
    // Load the lock above the big gun
    loader.load('models/lock.gltf', function(gltf) {
        big_gun.lock = gltf.scene;
        big_gun.lock.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        big_gun.lock.position.set(40, 4, -5);
        big_gun.lock.scale.set(3, 3, 3);
        big_gun.lock.rotation.set(0, Math.PI, 0);
        scene.add(big_gun.lock);
    }, undefined, function(error) {
        console.error(error);
    });
    // Create a box under the gun
    var gunBoxMesh = new THREE.Mesh(gunBoxGeo, gunBoxMat);
    gunBoxMesh.castShadow = true;
    gunBoxMesh.receiveShadow = true;
    gunBoxMesh.position.set(40, 0.2, -5);
    scene.add(gunBoxMesh);
    // Put a little plane with a texture to show the price above the gun
    var labelGeo = new THREE.PlaneGeometry(4, 2);
    var texture = new THREE.TextureLoader(loadingManager).load('images/coins20.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x1ff2ff,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    big_gun.texture = new THREE.Mesh(labelGeo, labelMat);
    big_gun.texture.rotation.set(0, -.5*Math.PI, 0);
    big_gun.texture.position.set(38.5, 5, -5);
    big_gun.texture.castShadow = true;
    big_gun.texture.receiveShadow = true;
    scene.add(big_gun.texture);

    //=================================================
    // MEDIUM GUN
    // Load the medium gun
    loader.load('models/mediumGun.gltf', function(gltf) {
        var gun = gltf.scene;
        gun.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        // Add the gun to the pickable items
        pickableObjects.push(gun);
        gun.position.set(40, 1, 0);
        gun.scale.set(3, 3, 3);
        // Give a name to retrieve the mesh in the raycaster switch
        gun.name = 'mediumGun';
        scene.add(gun);
    }, undefined, function(error) {
        console.error(error);
    });
    // Load a lock above the gun
    loader.load('models/lock.gltf', function(gltf) {
        medium_gun.lock = gltf.scene;
        medium_gun.lock.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        medium_gun.lock.position.set(40, 4, 0);
        medium_gun.lock.scale.set(3, 3, 3);
        medium_gun.lock.rotation.set(0, Math.PI, 0);
        scene.add(medium_gun.lock);
    }, undefined, function(error) {
        console.error(error);
    });
    // Create a box under the gun
    var gunBoxMesh = new THREE.Mesh(gunBoxGeo, gunBoxMat);
    gunBoxMesh.castShadow = true;
    gunBoxMesh.receiveShadow = true;
    gunBoxMesh.position.set(40, 0.2, 0);
    scene.add(gunBoxMesh);
    // Put a little plane with a texture to show the price above the gun
    var labelGeo = new THREE.PlaneGeometry(4, 2);
    var texture = new THREE.TextureLoader(loadingManager).load('images/coins5.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x1ff2ff,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    medium_gun.texture = new THREE.Mesh(labelGeo, labelMat);
    medium_gun.texture.rotation.set(0, -.5*Math.PI, 0);
    medium_gun.texture.position.set(38.5, 5, 0);
    medium_gun.texture.castShadow = true;
    medium_gun.texture.receiveShadow = true;
    scene.add(medium_gun.texture);

    //=================================================
    // LITTLE GUN
    // Load the little gun
    loader.load('models/littleGun.gltf', function(gltf) {
        var gun = gltf.scene;
        gun.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        // Add the gun to the pickable items
        pickableObjects.push(gun);
        gun.position.set(40, 3, 5);
        gun.scale.set(3, 3, 3);
        // Give a name to retrieve the mesh in the raycaster switch
        gun.name = 'littleGun';
        // Set this gun as the selected one
        selected = gun;
        scene.add(gun);
    }, undefined, function(error) {
        console.error(error);
    });
    // Put a little plane with a texture to show the price above the gun
    var gunBoxMesh = new THREE.Mesh(gunBoxGeo, gunBoxMat);
    gunBoxMesh.castShadow = true;
    gunBoxMesh.receiveShadow = true;
    gunBoxMesh.position.set(40, 0.2, 5);
    scene.add(gunBoxMesh);

}

//===================================================================
// LOADING TRAINING FUNCTION
function loadTraining() {
    // Load the target
    loader.load('models/target.gltf', function(gltf) {
        var targetMesh = gltf.scene;
        targetMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        targetMesh.scale.set(10, 10, 10);
        targetMesh.position.set(45, -2, -30);
        targetMesh.rotation.set(0, -.5*Math.PI, 0);
        scene.add(targetMesh);
    }, undefined, function(error) {
        console.error(error);
    });

    // Give to the target a body of a box
    targetPhysMat = new CANNON.Material();

    var targetBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(2.5, 2.5, 1)),
        position: new CANNON.Vec3(45, 2.5, -30),
        material: robotPhysMat,
        // The target can collide with everything
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
    targetBody.quaternion.setFromEuler(0, -.5*Math.PI, 0);
    world.addBody(targetBody);

    // Create a little box to put a pyramid of cylinders on it
    var boxGeo = new THREE.BoxGeometry(8, 1, 4);
    var boxMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
    });
    var boxMesh = new THREE.Mesh(boxGeo, boxMat);
    boxMesh.position.set(35, 1, -40);
    boxMesh.castShadow = true;
    boxMesh.receiveShadow = true;
    scene.add(boxMesh);

    var boxBody = new CANNON.Body({
        type: CANNON.Body.STATIC,
        shape: new CANNON.Box(new CANNON.Vec3(4, 0.5, 2)),
        position: new CANNON.Vec3(35, 1, -40),
        collisionFilterGroup: GROUP_OBJECTS,
        collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
    });
    world.addBody(boxBody);

    // Create the mesh of a cylinder to use that as a button
    var buttonGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.3, 16);
    var buttonMat = new THREE.MeshStandardMaterial({
        color: 0xffc000,
    });
    var buttonMesh = new THREE.Mesh(buttonGeo, buttonMat);
    buttonMesh.position.set(35, 1, -38);
    buttonMesh.rotation.set(.5*Math.PI, 0, 0);
    // Add the button to the pickable objects, to pick it with raycaster
    buttonMesh.name = 'button';
    pickableObjects.push(buttonMesh);
    scene.add(buttonMesh);
}

function loadPyramid() {
    // Pyramid of cylinders
    // First row of grenades
    for (let i = 33; i <= 37; i += 2) {
        // Load the grenade
        loader.load('models/grenade.gltf', function(gltf) {
            var grenadeMesh = gltf.scene;
            grenadeMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            grenadeMesh.scale.set(8, 8, 8);
            grenadeMesh.position.set(i, 3, -40);
            scene.add(grenadeMesh);

            // Create a cylinder body for the grenade
            grenadePhysMat = new CANNON.Material();

            var grenadeBody = new CANNON.Body({
                mass: 2,
                shape: new CANNON.Cylinder(0.7, 0.7, 2.2, 32),
                position: new CANNON.Vec3(i, 3, -40),
                material: grenadePhysMat,
                collisionFilterGroup: GROUP_OBJECTS,
                collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
            });
            world.addBody(grenadeBody);
            // Store the grenade mesh and body in an array
            grenades.push({mesh: grenadeMesh, body: grenadeBody});
        }, undefined, function(error) {
            console.error(error);
        });
    }
    // Second row of grenades
    for (let i = 34; i <= 36; i += 2) {
        // Load the grenade
        loader.load('models/grenade.gltf', function(gltf) {
            var grenadeMesh = gltf.scene;
            grenadeMesh.traverse((child) => {
                if (child.isMesh) {
                    child.castShadow = true;
                    child.receiveShadow = true;
                }
            });
            grenadeMesh.scale.set(8, 8, 8);
            // Position the row slightly above the other one
            grenadeMesh.position.set(i, 5.5, -40);
            scene.add(grenadeMesh);

            // Create a cylinder body for the grenade
            grenadePhysMat = new CANNON.Material();

            var grenadeBody = new CANNON.Body({
                mass: 2,
                shape: new CANNON.Cylinder(0.7, 0.7, 2.2, 32),
                position: new CANNON.Vec3(i, 5.5, -40),
                material: grenadePhysMat,
                collisionFilterGroup: GROUP_OBJECTS,
                collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
            });
            world.addBody(grenadeBody);
            // Store the grenade mesh and body in the array
            grenades.push({mesh: grenadeMesh, body: grenadeBody});
        }, undefined, function(error) {
            console.error(error);
        });
    }
    // Last row of grenades
    // Load the last grenade
    loader.load('models/grenade.gltf', function(gltf) {
        var grenadeMesh = gltf.scene;
        grenadeMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        grenadeMesh.scale.set(8, 8, 8);
        grenadeMesh.position.set(35, 8, -40);
        scene.add(grenadeMesh);

        // Create a cylinder body for the grenade
        grenadePhysMat = new CANNON.Material();

        var grenadeBody = new CANNON.Body({
            mass: 2,
            shape: new CANNON.Cylinder(0.7, 0.7, 2.2, 32),
            position: new CANNON.Vec3(35, 8, -40),
            material: grenadePhysMat,
            collisionFilterGroup: GROUP_OBJECTS,
            collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
        });
        world.addBody(grenadeBody);
        // Store the grenade mesh and body in the array
        grenades.push({mesh: grenadeMesh, body: grenadeBody});
    }, undefined, function(error) {
        console.error(error);
    });
}

//===================================================================
// LOADING SPIN FUNCTION
function loadSpin() {
    // Crate 1: load the 3D model
    loader.load('models/crate.gltf', function(gltf) {
        var crateMesh = gltf.scene;
        crateMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        crateMesh.scale.set(4, 4, 4);
        crateMesh.position.set(45, 0, 45);
        // Assign a name to pick the crate in raycasting
        crateMesh.name = '1coin';
        crates.push(crateMesh);
        scene.add(crateMesh);

        // Create a body of a box for the crate
        cratePhysMat = new CANNON.Material();

        var crateBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 1.5)),
            position: new CANNON.Vec3(45, 1.5, 45),
            material: cratePhysMat,
            collisionFilterGroup: GROUP_OBJECTS,
            collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
        });
        world.addBody(crateBody);

    }, undefined, function(error) {
        console.error(error);
    });
    // Create a little plane with a texture showing the price of the crate
    var labelGeo = new THREE.PlaneGeometry(4, 2);
    var texture = new THREE.TextureLoader(loadingManager).load('images/coin1.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x1ff2ff,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    var crateTexture = new THREE.Mesh(labelGeo, labelMat);
    crateTexture.rotation.set(0, -.75*Math.PI, 0);
    crateTexture.position.set(45, 5, 45);
    crateTexture.castShadow = true;
    crateTexture.receiveShadow = true;
    scene.add(crateTexture);

    // Crate 2: load the 3D model
    loader.load('models/crate2.gltf', function(gltf) {
        var crateMesh = gltf.scene;
        crateMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        crateMesh.scale.set(8, 8, 8);
        crateMesh.position.set(35, 1.5, 45);
        // Assign a name to pick the crate in raycasting
        crateMesh.name = '2coins';
        crates.push(crateMesh);
        scene.add(crateMesh);

        // Create a body of a box for the crate
        cratePhysMat = new CANNON.Material();

        var crateBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 1.5)),
            position: new CANNON.Vec3(35, 1.5, 45),
            material: cratePhysMat,
            collisionFilterGroup: GROUP_OBJECTS,
            collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
        });
        world.addBody(crateBody);

    }, undefined, function(error) {
        console.error(error);
    });
    // Create a little plane with a texture showing the price of the crate
    var labelGeo = new THREE.PlaneGeometry(4, 2);
    var texture = new THREE.TextureLoader(loadingManager).load('images/coins2.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x1ff2ff,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    var crateTexture = new THREE.Mesh(labelGeo, labelMat);
    crateTexture.rotation.set(0, Math.PI, 0);
    crateTexture.position.set(35, 5, 45);
    crateTexture.castShadow = true;
    crateTexture.receiveShadow = true;
    scene.add(crateTexture);

    // Crate 3: load the 3D model
    loader.load('models/crate3.gltf', function(gltf) {
        var crateMesh = gltf.scene;
        crateMesh.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });
        crateMesh.scale.set(3.5, 3.5, 3.5);
        crateMesh.position.set(45, 1.5, 35);
        crateMesh.rotation.set(0, -.5 * Math.PI, 0);
        // Assign a name to pick the crate in raycasting
        crateMesh.name = '5coins';
        crates.push(crateMesh);
        scene.add(crateMesh);

        // Create a body of a box for the crate
        cratePhysMat = new CANNON.Material();

        var crateBody = new CANNON.Body({
            mass: 0,
            shape: new CANNON.Box(new CANNON.Vec3(1.5, 1.5, 1.5)),
            position: new CANNON.Vec3(45, 1.5, 35),
            material: cratePhysMat,
            collisionFilterGroup: GROUP_OBJECTS,
            collisionFilterMask: GROUP_OBJECTS | GROUP_PLAYER | GROUP_BULLETS
        });
        world.addBody(crateBody);

    }, undefined, function(error) {
        console.error(error);
    });
    // Create a little plane with a texture showing the price of the crate
    var labelGeo = new THREE.PlaneGeometry(4, 2);
    var texture = new THREE.TextureLoader(loadingManager).load('images/coins5.png');
    var labelMat = new THREE.MeshPhongMaterial({
        color: 0x1ff2ff,
        map: texture,
        side: THREE.DoubleSide,
        transparent: true
    });
    var crateTexture = new THREE.Mesh(labelGeo, labelMat);
    crateTexture.rotation.set(0, -.5*Math.PI, 0);
    crateTexture.position.set(45, 5, 35);
    crateTexture.castShadow = true;
    crateTexture.receiveShadow = true;
    scene.add(crateTexture);
}

//===================================================================
// SHOOTING FUNCTION
function shootBullet() {
    var bulletGeo, bulletBody;
    // You can shoot only if you still have bullets left
    if (bullets.length < player.maxBullets) {
        // The bullet is created w.r.t. the selected gun
        switch(selected.name) {
            case 'bigGun':
                // If the selected gun is the big one, the bullets have the maximum radius = 1
                bulletGeo = new THREE.SphereGeometry(1, 8, 8);

                bulletBody = new CANNON.Body({
                    // The bullets have a big mass
                    mass: 20,
                    shape: new CANNON.Sphere(1),
                    // The bullet starts from the camera position
                    position: new CANNON.Vec3(
                        camera.position.x,
                        camera.position.y,
                        camera.position.z
                    ),
                    material: bulletPhysMat,
                    // Bullets can't interact with the player
                    collisionFilterGroup: GROUP_BULLETS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_BULLETS
                });
                break;
            case 'mediumGun':
                // If the selected gun is the medium one, the bullets have the medium radius = 0.5
                bulletGeo = new THREE.SphereGeometry(0.5, 8, 8);

                bulletBody = new CANNON.Body({
                    // The bullets have less mass
                    mass: 10,
                    shape: new CANNON.Sphere(0.5),
                    // The bullet starts from the camera position
                    position: new CANNON.Vec3(
                        camera.position.x,
                        camera.position.y,
                        camera.position.z
                    ),
                    material: bulletPhysMat,
                    // Bullets can't interact with the player
                    collisionFilterGroup: GROUP_BULLETS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_BULLETS
                });
                break;
            case 'littleGun':
                // If the selected gun is the little one, the bullets have the smallest radius = 0.2
                bulletGeo = new THREE.SphereGeometry(0.2, 8, 8);

                bulletBody = new CANNON.Body({
                    // The bullets have a little mass
                    mass: 5,
                    shape: new CANNON.Sphere(0.2),
                    // The bullet starts from the camera position
                    position: new CANNON.Vec3(
                        camera.position.x,
                        camera.position.y,
                        camera.position.z
                    ),
                    material: bulletPhysMat,
                    // bullets can't interact with the player
                    collisionFilterGroup: GROUP_BULLETS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_BULLETS
                });
                break;
            default:
                // The default case is the little gun one
                bulletGeo = new THREE.SphereGeometry(0.2, 8, 8);

                bulletBody = new CANNON.Body({
                    mass: 5,
                    shape: new CANNON.Sphere(0.2),
                    position: new CANNON.Vec3(
                        camera.position.x,
                        camera.position.y,
                        camera.position.z
                    ),
                    material: bulletPhysMat,
                    collisionFilterGroup: GROUP_BULLETS,
                    collisionFilterMask: GROUP_OBJECTS | GROUP_BULLETS
                });
        }
        
        // BULLET IN THREE.JS
        // Generate the mesh of the bullet with the current color
        var bulletMat = new THREE.MeshStandardMaterial({
            color: player.color
        });
        var bulletMesh = new THREE.Mesh(bulletGeo, bulletMat);
        bulletMesh.castShadow = true;
        bulletMesh.receiveShadow = true;

        scene.add(bulletMesh);

        // BULLET BODY
        bulletPhysMat = new CANNON.Material();
        // Air resistance
        bulletBody.linearDamping = 0.2;
        // To give velocity to the bullet take the direction at which the camera is looking
        var direction = new THREE.Vector3();
        camera.getWorldDirection(direction);
        var velocity = new CANNON.Vec3(
            direction.x, 
            direction.y,
            direction.z).scale(50 + player.fast);
        // Assign the velocity to the body of the bullet towards the direction looked by the camera
        bulletBody.velocity.set(
            velocity.x, 
            velocity.y, 
            velocity.z);
        // Store the bullet
        bullets.push({mesh: bulletMesh, body: bulletBody});
        
        world.addBody(bulletBody);

        // Decrease the maximum amount of bullets by the number of created bullets
        // To show how many you can still create before filling the array
        document.getElementById("bullets").innerHTML = player.maxBullets - bullets.length;

        // ==============================================================
        // CONTACT BETWEEN MATERIALS

        const bulletFloorContactMat = new CANNON.ContactMaterial(
            bulletPhysMat,
            floorPhysMat,
            {restitution: 0.5}
        );

        world.addContactMaterial(bulletFloorContactMat);

        const bulletWallContactMat = new CANNON.ContactMaterial(
            bulletPhysMat,
            wallPhysMat,
            {restitution: 0.5}
        );

        world.addContactMaterial(bulletWallContactMat);
    }
}

//===================================================================
// RELOADING FUNCTION
function reloadGuns() {
    // Remove all the created bullets from the scene and from the world
    // This works because the number of bullets is calculated starting from the
    // created ones, so now the array is empty
    while (bullets.length > 0) {
        let b = bullets.pop();
        scene.remove(b.mesh);
        world.removeBody(b.body);
    }
    // Hide the reloading div and show again the maximum number of bullets
    document.getElementById('reloading').style.visibility = "hidden";
    document.getElementById("bullets").innerHTML = player.maxBullets;
}
