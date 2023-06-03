#version 300 es

#define M_2PI 6.28318530717958647692528676655900576
#define MAX_ITERATIONS 20

precision highp float;
in vec2 vTexPosition;
out vec4 FragColor;
uniform sampler2D uTexture;

uniform float uScale;
uniform float uRotation;
uniform vec2 uTranslation;
uniform vec2 uOrigin;
uniform float uTime;
uniform bool uBoundary;
uniform vec2 uSize;
uniform vec2 uLatticePoint;

vec2 w_to_z(vec2 w) { return exp(w.x) * vec2(cos(w.y), sin(w.y)); }
vec2 z_to_w(vec2 z) { return vec2(log(length(z)), atan(z.y, z.x)); }
vec2 cx_mul(vec2 a, vec2 b) { return vec2(a.x * b.x - a.y * b.y, a.x * b.y + a.y * b.x); }
vec2 cx_div(vec2 a, vec2 b) { return vec2(((a.x * b.x + a.y * b.y) / (b.x * b.x + b.y * b.y)), ((a.y * b.x - a.x * b.y) / (b.x * b.x + b.y * b.y))); }

bool in_box(vec2 z) {
    return z.y >= -0.5 && z.y <= 0.5 && z.x >= -0.5 * uSize.x / uSize.y && z.x <= 0.5 * uSize.x / uSize.y;
}

vec2 rotate(vec2 v, float a) {
	float s = sin(a);
	float c = cos(a);
	mat2 m = mat2(c, -s, s, c);
	return m * v;
}

vec4 source(vec2 z) {
    // Zoom in if necessary
    for(int i = 0;i < MAX_ITERATIONS; ++i) {
        if (!in_box(z))
            z = uScale * rotate(z, uRotation) + uTranslation;
        else {
            break;
        }
    }
    // Zoom out if necessary
    for (int i = 0; i < MAX_ITERATIONS; ++i) {
        vec2 zz = rotate(z - uTranslation, -uRotation) / uScale;
        if (!in_box(zz))
            break;
        z = zz;
    }

    // Render boundary
    if(uBoundary) {
        float eps = 0.01;
        if (z.y < (-0.5 + eps) ||
            z.y > (0.5 - eps) ||
            z.x < (-0.5 + eps) * uSize.x / uSize.y ||
            z.x > (0.5 - eps) * uSize.x / uSize.y) {
            return vec4(0.0, 1.0, 0.0, 1.0);
        }
    }

    return texture(uTexture, vec2(0.5 + z.x * uSize.y / uSize.x, 0.5 - z.y));
}

void main() {
    // Delta is the (possibly complex) scaling factor under which the image is invariant
    vec2 log_delta = vec2(-log(uScale), uRotation);

    // Compute alpha
    vec2 alpha = cx_div(uLatticePoint.x * log_delta + uLatticePoint.y * vec2(0, M_2PI), vec2(0, M_2PI));
    vec2 alpha_inv = vec2(alpha.x, -alpha.y) / dot(alpha, alpha);

    // Compute gamma: the scaling factor under which the transformed image is invariant
    vec2 log_gamma = cx_mul(log_delta, alpha_inv);

    // Compute z
    vec2 z = vec2(vTexPosition.x - 0.5, 0.5 - vTexPosition.y) - uOrigin;

    // Transform to w    
    vec2 w = z_to_w(z);
    w -= log_gamma * mod(uTime * 0.1, 1.0);

    // Transform under multiplication by alpha
    w = cx_mul(w, alpha);

    // Transform to z
    z = w_to_z(w);
    
    // Get pixel
    FragColor = source(z + uOrigin);
}
