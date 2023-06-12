declare var CCapture: any;

let canvas: HTMLCanvasElement = null;
let gl: WebGLRenderingContext = null;
let vertexBuffer: Buffer = null;
let shader: Shader = null;
let texture: Texture = null;

let time: number = 0;

let options = {
  boundary: false,
  animationSpeed: 0.0,
  latticePoint: [1.0, 1.0],
  scale: 4.0,
  translation: [0.0, 0.0],
  rotation: 0.0
};

const FPS = 60.0;

async function setupWebGL(_canvas: HTMLCanvasElement, width: number, height: number) {
  // Set canvas size
  canvas = _canvas;
  canvas.width = width;
  canvas.height = height;

  // Create GL context
  gl = canvas.getContext('webgl2');
  if (gl === null) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Create texture
  texture = new Texture(gl);
  texture.setImageData($('image') as HTMLImageElement);

  // Create vertex buffer
  vertexBuffer = new Buffer(gl);
  vertexBuffer.setData([-1.0, -1.0, 1.0, -1.0, -1.0, 1.0, 1.0, 1.0]);

  // Create shader program
  const vsSource = await fetch('shader/shader.vert').then(response => response.text());
  const fsSource = await fetch('shader/shader.frag').then(response => response.text());
  shader = new Shader(gl, vsSource, fsSource);
}

async function init() {
  // Initialize WebGL context
  const canvas = $('canvas') as HTMLCanvasElement;
  await setupWebGL(canvas, canvas.clientWidth * window.devicePixelRatio, canvas.clientHeight * window.devicePixelRatio);

  // Set starting time
  time = 0.0;

  // Keep rendering
  setInterval(() => { if (options.animationSpeed != 0.0) render(); }, 1000.0 / FPS);
  render();

  // Controls
  ($('checkbox-boundary') as HTMLInputElement).checked = options.boundary;
  onInput($('checkbox-boundary'), function () { options.boundary = !options.boundary; render(); });
  ($('range-animation-speed') as HTMLInputElement).value = '' + options.animationSpeed;
  onInput($('range-animation-speed'), function () { options.animationSpeed = parseFloat((this as HTMLInputElement).value); render(); });
  ($('input-lattice-x') as HTMLInputElement).value = '' + options.latticePoint[0];
  ($('input-lattice-y') as HTMLInputElement).value = '' + options.latticePoint[1];
  onInput($('input-lattice-x'), function () { options.latticePoint[0] = parseFloat((this as HTMLInputElement).value); render(); });
  onInput($('input-lattice-y'), function () { options.latticePoint[1] = parseFloat((this as HTMLInputElement).value); render(); });
  ($('input-translation-x') as HTMLInputElement).value = '' + options.translation[0];
  ($('input-translation-y') as HTMLInputElement).value = '' + options.translation[1];
  onInput($('input-translation-x'), function () { options.translation[0] = parseFloat((this as HTMLInputElement).value); render(); });
  onInput($('input-translation-y'), function () { options.translation[1] = parseFloat((this as HTMLInputElement).value); render(); });
  ($('input-scale') as HTMLInputElement).value = '' + options.scale;
  onInput($('input-scale'), function () { options.scale = parseFloat((this as HTMLInputElement).value); render(); });
  ($('input-rotation') as HTMLInputElement).value = '' + options.rotation;
  onInput($('input-rotation'), function () { options.rotation = parseFloat((this as HTMLInputElement).value); render(); });

  onChange($('input-file'), function (event) {
    const file = (this as HTMLInputElement).files[0];
    const reader = new FileReader();
    reader.addEventListener('load', () => {
      // Convert image file to base64 string
      const image = $('image') as HTMLImageElement;
      image.onload = function () { texture.setImageData(image); render(); };
      image.src = reader.result as string;
    }, false);
    if (file)
      reader.readAsDataURL(file);
  });

  onClick($('button-gif') as HTMLButtonElement, exportGIF);
}

function render() {
  // Clear canvas
  gl.clearColor(0.0, 0.0, 0.0, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT);

  // Bind buffer
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    vertexBuffer.bind();
    gl.vertexAttribPointer(shader.attribLocations.vertexPosition, numComponents, type, normalize, stride, offset);
    gl.enableVertexAttribArray(shader.attribLocations.vertexPosition);
  }

  // Use program
  shader.use();

  // Set uniforms
  {
    // Texture
    texture.bind(0);
    gl.uniform1i(shader.uniformLocations['uTexture'], 0);

    // Transformations
    const translation = { x: options.translation[0], y: options.translation[1] };
    const scale = 1.0 / options.scale;
    const rotation = options.rotation / 180.0 * Math.PI;

    const scaleRotation = new Float32Array([
      scale * Math.cos(rotation), scale * Math.sin(rotation),
      -scale * Math.sin(rotation), scale * Math.cos(rotation)
    ]);
    let origin = { x: 0, y: 0 };
    for (let i = 0; i < 20; ++i) {
      origin = {
        x: scaleRotation[0] * origin.x + scaleRotation[1] * origin.y + translation.x,
        y: scaleRotation[2] * origin.x + scaleRotation[3] * origin.y + translation.y
      };
    }
    gl.uniform1f(shader.uniformLocations['uScale'], scale);
    gl.uniform1f(shader.uniformLocations['uRotation'], rotation);
    gl.uniform2f(shader.uniformLocations['uTranslation'], translation.x, translation.y);
    gl.uniform2f(shader.uniformLocations['uOrigin'], origin.x, origin.y);
    gl.uniform1f(shader.uniformLocations['uTime'], time);
    gl.uniform2f(shader.uniformLocations['uSize'], texture.width, texture.height);
    gl.uniform1i(shader.uniformLocations['uBoundary'], options.boundary ? 1 : 0);
    gl.uniform2f(shader.uniformLocations['uLatticePoint'], options.latticePoint[0], options.latticePoint[1]);
  }

  // Update time
  time += 1.0 / FPS * options.animationSpeed;

  // Draw arrays
  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
}

window.onload = init;

async function exportGIF() {
  const button = $('button-gif') as HTMLButtonElement;
  button.disabled = true;

  const newCanvas = create('canvas', { 'width': 512, 'height': 512 }) as HTMLCanvasElement;
  await setupWebGL(newCanvas, 512, 512);

  const capturer = new CCapture({
    format: 'gif',
    workersPath: 'js/',
    framerate: FPS
  });

  capturer.start();
  for (let t = 0; t < 1.0; t += 1.0 / FPS) {
    time = t;
    render();
    capturer.capture(newCanvas);
  }
  capturer.stop();
  capturer.save();

  const canvas = $('canvas') as HTMLCanvasElement;
  await setupWebGL(canvas, canvas.clientWidth * window.devicePixelRatio, canvas.clientHeight * window.devicePixelRatio);
  button.disabled = false;
}
