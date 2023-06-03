#version 300 es
precision highp float;

in vec4 aVertexPosition;
out vec2 vTexPosition;

void main() {
    vTexPosition = 0.5 * vec2(1.0 + aVertexPosition.x, 1.0 - aVertexPosition.y);
    gl_Position = aVertexPosition;
}
