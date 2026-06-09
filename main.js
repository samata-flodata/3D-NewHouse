const MODELS = {
  "first-floor": {
    label: "1st floor",
    url: "./new_house1st_floor_fast_ui.glb",
  },
  "second-floor": {
    label: "2nd floor",
    url: "./new_house2nd_floor_fast_ui.glb",
  },
};

const placement = {
  latitude: 28.660825288456,
  longitude: 77.122364943489,
  height: 0,
  heading: 0,
  scale: 1,
};

const statusText = document.querySelector("#status");
const loaderPanel = document.querySelector("#loader");
const progressBar = document.querySelector("#bar");
const percentText = document.querySelector("#percent");
const satelliteButton = document.querySelector("#satelliteButton");
const firstFloorButton = document.querySelector("#firstFloorButton");
const secondFloorButton = document.querySelector("#secondFloorButton");

Cesium.Ion.defaultAccessToken = "";

const satelliteProvider = () =>
  new Cesium.UrlTemplateImageryProvider({
    url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    credit:
      "Tiles courtesy of Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    maximumLevel: 19,
  });

const viewer = new Cesium.Viewer("map", {
  animation: false,
  baseLayerPicker: false,
  fullscreenButton: false,
  geocoder: false,
  homeButton: false,
  infoBox: false,
  sceneModePicker: false,
  selectionIndicator: false,
  timeline: false,
  navigationHelpButton: false,
  terrainProvider: new Cesium.EllipsoidTerrainProvider(),
  imageryProvider: false,
});

viewer.scene.globe.depthTestAgainstTerrain = true;
viewer.scene.skyAtmosphere.show = true;
viewer.scene.globe.enableLighting = true;
viewer.scene.backgroundColor = Cesium.Color.BLACK;

const modelPrimitives = new Map();
const loadingModels = new Set();
let activeView = "second-floor";
let activeFloor = "second-floor";
let satelliteLayer = null;
const cameraSettings = {
  heading: 311.09,
  pitch: -55.817,
  distance: 37.952,
};
const floorCameraDefaults = {
  "first-floor": {
    heading: 311.09,
    pitch: -55.817,
    distance: 37.952,
  },
  "second-floor": {
    heading: 311.09,
    pitch: -55.817,
    distance: 37.952,
  },
};
const satelliteCameraDefaults = {
  heading: 300,
  pitch: -53.254,
  distance: 105.152,
};

function getModelMatrix() {
  const position = Cesium.Cartesian3.fromDegrees(
    placement.longitude,
    placement.latitude,
    placement.height,
  );
  const headingPitchRoll = new Cesium.HeadingPitchRoll(
    Cesium.Math.toRadians(placement.heading),
    0,
    0,
  );
  return Cesium.Transforms.headingPitchRollToFixedFrame(position, headingPitchRoll);
}

async function updateModel(floor = activeFloor) {
  const model = MODELS[floor];
  const modelPrimitive = modelPrimitives.get(floor);

  if (modelPrimitive) {
    modelPrimitive.modelMatrix = getModelMatrix();
    modelPrimitive.scale = placement.scale;
    updateModelVisibility();
    if (activeView !== "satellite") zoomToModel();
    return;
  }

  if (loadingModels.has(floor)) return;

  loadingModels.add(floor);
  loaderPanel.classList.remove("is-hidden");
  statusText.textContent = `Loading ${model.label} GLB model...`;
  progressBar.style.width = "45%";
  percentText.textContent = "Loading";

  try {
    const loadedModel = await Cesium.Model.fromGltfAsync({
      url: model.url,
      modelMatrix: getModelMatrix(),
      scale: placement.scale,
      shadows: Cesium.ShadowMode.DISABLED,
    });

    viewer.scene.primitives.add(loadedModel);
    modelPrimitives.set(floor, loadedModel);
    progressBar.style.width = "100%";
    percentText.textContent = "100%";
    setStatusText();
    loaderPanel.classList.add("is-hidden");
    updateModelVisibility();
    if (activeView !== "satellite") zoomToModel();
  } catch (error) {
    console.error(error);
    const message = error?.message || String(error);
    statusText.textContent =
      `Could not load the GLB: ${message}`;
    progressBar.style.width = "100%";
    percentText.textContent = "Error";
  } finally {
    loadingModels.delete(floor);
  }
}

function zoomToModel() {
  if (!modelPrimitives.get(activeFloor) && !loadingModels.has(activeFloor)) return;

  setCameraView(cameraSettings, 0.8);
}

function setActiveButton() {
  satelliteButton.classList.toggle("is-active", activeView === "satellite");
  firstFloorButton.classList.toggle(
    "is-active",
    activeView === "floor-only" && activeFloor === "first-floor",
  );
  secondFloorButton.classList.toggle("is-active", activeView === "second-floor");
}

function setStatusText() {
  const floorLabel = MODELS[activeFloor].label;
  const hasActiveModel = modelPrimitives.has(activeFloor);
  statusText.textContent =
    activeView === "satellite"
      ? hasActiveModel
        ? `Satellite basemap and ${floorLabel} model visible.`
        : "Satellite basemap visible."
      : `${floorLabel} model only.`;
}

function updateModelVisibility() {
  for (const [floor, primitive] of modelPrimitives) {
    primitive.show = floor === activeFloor;
  }
}

function updateLoadedModelPlacement() {
  for (const primitive of modelPrimitives.values()) {
    primitive.modelMatrix = getModelMatrix();
    primitive.scale = placement.scale;
  }
}

function setCameraView({ heading, pitch, distance }, duration = 0.35) {
  cameraSettings.heading = heading;
  cameraSettings.pitch = pitch;
  cameraSettings.distance = distance;

  const target = Cesium.Cartesian3.fromDegrees(
    placement.longitude,
    placement.latitude,
    placement.height,
  );
  const offset = new Cesium.HeadingPitchRange(
    Cesium.Math.toRadians(heading),
    Cesium.Math.toRadians(pitch),
    Math.max(distance, 10),
  );

  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(target, 1), {
    duration,
    offset,
    complete: () => {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    },
    cancel: () => {
      viewer.camera.lookAtTransform(Cesium.Matrix4.IDENTITY);
    },
  });
}

function showSatelliteLayer() {
  if (!satelliteLayer) {
    satelliteLayer = viewer.imageryLayers.addImageryProvider(satelliteProvider(), 0);
  }

  satelliteLayer.show = true;
}

function hideSatelliteLayer() {
  if (satelliteLayer) satelliteLayer.show = false;
}

function setSatelliteView() {
  activeView = "satellite";
  cameraSettings.heading = satelliteCameraDefaults.heading;
  cameraSettings.pitch = satelliteCameraDefaults.pitch;
  cameraSettings.distance = satelliteCameraDefaults.distance;
  showSatelliteLayer();
  viewer.scene.globe.show = true;
  viewer.scene.skyAtmosphere.show = true;
  if (viewer.scene.skyBox) viewer.scene.skyBox.show = true;
  if (viewer.scene.sun) viewer.scene.sun.show = true;
  if (viewer.scene.moon) viewer.scene.moon.show = true;
  updateModelVisibility();
  setActiveButton();
  setStatusText();
  setCameraView(cameraSettings, 0.2);
  viewer.scene.requestRender();
}

function setFloorView(floor) {
  activeView = floor === "second-floor" ? "second-floor" : "floor-only";
  activeFloor = floor;
  Object.assign(cameraSettings, floorCameraDefaults[floor]);
  hideSatelliteLayer();
  viewer.scene.globe.show = false;
  viewer.scene.skyAtmosphere.show = false;
  if (viewer.scene.skyBox) viewer.scene.skyBox.show = false;
  if (viewer.scene.sun) viewer.scene.sun.show = false;
  if (viewer.scene.moon) viewer.scene.moon.show = false;
  updateModelVisibility();
  setActiveButton();
  setStatusText();
  updateModel(floor);
  zoomToModel();
  viewer.scene.requestRender();
}

satelliteButton.addEventListener("click", () => {
  setSatelliteView();
});

secondFloorButton.addEventListener("click", () => {
  setFloorView("second-floor");
});

firstFloorButton.addEventListener("click", () => {
  setFloorView("first-floor");
});

setFloorView("first-floor");
