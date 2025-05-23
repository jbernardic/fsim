import "./style.css"
import * as BABYLON from "@babylonjs/core"
import "@babylonjs/loaders/glTF";
import { GridMaterial, SkyMaterial } from "@babylonjs/materials";


interface InputState{
  pitch: number, // -1 to 1
  yaw: number
}
const input: InputState = { pitch: 0, yaw: 0 };

const canvas = document.getElementById("renderCanvas") as HTMLCanvasElement;
const engine = new BABYLON.Engine(canvas, true);
const scene = new BABYLON.Scene(engine);

async function main() {
  // camera
  const camera = new BABYLON.FreeCamera("camera1", new BABYLON.Vector3(0, 5, -10), scene);
  camera.setTarget(BABYLON.Vector3.Zero());
  camera.attachControl(canvas, true);

  //lights
  const light = new BABYLON.HemisphericLight("light", new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.7;

  // player
  const playerAsset = await BABYLON.ImportMeshAsync("models/player.glb", scene);
  let playerModel: BABYLON.AbstractMesh;
  for (const mesh of playerAsset.meshes) {
    if (mesh.parent == null) {
      playerModel = mesh;
    }
  }

  // sky
  const skyMaterial = new SkyMaterial("skyMaterial", scene);
  skyMaterial.backFaceCulling = false;
  skyMaterial.inclination = 10;

  const skybox = BABYLON.MeshBuilder.CreateBox("skyBox", { size: 10000 }, scene);
  skybox.material = skyMaterial;

  //terain
  const terrain = BABYLON.MeshBuilder.CreateGround("terrain", { width: 10000, height: 10000 }, scene);
  const terrainMaterial = new GridMaterial("terrainMaterial", scene);
  terrainMaterial.mainColor = new BABYLON.Color3(0.05, 0.05, 0.1);
  
  terrain.material = terrainMaterial;

  scene.onKeyboardObservable.add((info) => {
    handleKeyboardInput(info);
  });

  engine.runRenderLoop(function () {
    const CAMERA_DISTANCE_BEHIND = 40;
    const CAMERA_DISTANCE_UP = 15;
    const CAMERA_TARGET_AHEAD = 50;
    const CAMERA_LERP_FACTOR = 0.3;

    const lastPlayerPos = playerModel.position.clone();
    applyFlightInput(playerModel);

    // camera calculation
    const desiredCamPos = playerModel.position.clone();
    desiredCamPos.subtractInPlace(playerModel.forward.scale(CAMERA_DISTANCE_BEHIND));
    desiredCamPos.addInPlace(playerModel.up.scale(CAMERA_DISTANCE_UP));

    const desiredTarget = playerModel.position.add(playerModel.forward.scale(CAMERA_TARGET_AHEAD));

    camera.position = BABYLON.Vector3.Lerp(camera.position, desiredCamPos, CAMERA_LERP_FACTOR);
    camera.setTarget(desiredTarget);
    camera.upVector = BABYLON.Vector3.Up();

    //terrain and skybox moving with player on x,z axis
    terrain.position.x = playerModel.position.x;
    terrain.position.z = playerModel.position.z;
    skybox.position = playerModel.position.clone();

    const dx = playerModel.position.x-lastPlayerPos.x;
    const dz = playerModel.position.z-lastPlayerPos.z;

    //add grid offset to simulate ground moving
    (terrain.material as GridMaterial).gridOffset.addInPlaceFromFloats(dx, 0, dz);

    scene.render();
  });
  // Watch for browser/canvas resize events
  window.addEventListener("resize", function () {
    engine.resize();
  });
}

function handleKeyboardInput(info: BABYLON.KeyboardInfo){
  //PITCH
  if (info.type == BABYLON.KeyboardEventTypes.KEYDOWN && info.event.key == "w") {
    input.pitch = 1;
  }
  else if (info.type == BABYLON.KeyboardEventTypes.KEYDOWN && info.event.key == "s") {
    input.pitch = -1;
  }
  else if (info.type == BABYLON.KeyboardEventTypes.KEYUP && info.event.key == "w" && input.pitch == 1) {
    input.pitch = 0;
  }
  else if (info.type == BABYLON.KeyboardEventTypes.KEYUP && info.event.key == "s" && input.pitch == -1) {
    input.pitch = 0;
  }
  //YAW
  if (info.type == BABYLON.KeyboardEventTypes.KEYDOWN && info.event.key == "a") {
    input.yaw = -1;
  }
  else if (info.type == BABYLON.KeyboardEventTypes.KEYDOWN && info.event.key == "d") {
    input.yaw = 1;
  }
  else if (info.type == BABYLON.KeyboardEventTypes.KEYUP && info.event.key == "a" && input.yaw == -1) {
    input.yaw = 0;
  }
  else if (info.type == BABYLON.KeyboardEventTypes.KEYUP && info.event.key == "d" && input.yaw == 1) {
    input.yaw = 0;
  }
}

function applyFlightInput(playerModel: BABYLON.AbstractMesh){
  const PITCH_SPEED = 0.02; 
  const YAW_SPEED = 0.02;
  const ROLL_SPEED = 0.006;
  const PLANE_SPEED = 50; // units per second

  playerModel.rotate(BABYLON.Axis.X, input.pitch * PITCH_SPEED, BABYLON.Space.LOCAL);
  playerModel.rotate(BABYLON.Axis.Y, input.yaw * YAW_SPEED, BABYLON.Space.WORLD); // world space because I don't want roll to affect yaw

  const rollAngle = playerModel.rotationQuaternion.toEulerAngles().z; // limiting roll angle to [-0.2, 0.2]
  if (input.yaw < 0 && rollAngle >= -0.2 || input.yaw > 0 && rollAngle <= 0.2) {
    playerModel.rotate(BABYLON.Axis.Z, input.yaw * ROLL_SPEED, BABYLON.Space.LOCAL);
  }

  //if player isn't moving yaw, slerp roll to 0
  if (input.yaw == 0) {
    const euler = playerModel.rotationQuaternion.toEulerAngles();
    const targetQuat = BABYLON.Quaternion.RotationYawPitchRoll(
      euler.y,
      euler.x,
      0
    );
    playerModel.rotationQuaternion = BABYLON.Quaternion.Slerp(playerModel.rotationQuaternion, targetQuat, 0.1);
  }

  const forwardDirection = playerModel.forward;
  const deltaTime = scene.getEngine().getDeltaTime() / 1000.0; // convert ms to seconds
  const moveDistance = PLANE_SPEED * deltaTime;
  playerModel.position.addInPlace(forwardDirection.scale(moveDistance));
}

main();
