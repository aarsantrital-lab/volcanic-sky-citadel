# Aethelgard: The Caldera Bastion — 3D Voxel Observatory

> **Live Demo:** [https://aarsantrital-lab.github.io/volcanic-sky-citadel/](https://aarsantrital-lab.github.io/volcanic-sky-citadel/)

An interactive, high-density 3D Voxel Observatory rendered in real-time WebGL 2.0 with hardware instancing, multi-octave 3D noise generation, volumetric magma lighting, dynamic camera controls, and architectural layer filtering.

---

## 🌋 Features

- **High-Density Voxel World**: 144 × 310 × 144 procedural voxel grid featuring inverted volcanic cone, abyssal lava falls, caldera lake, curtain walls, bastions, and gothic cathedral-citadel towers.
- **Hardware-Instanced Rendering**: Renders tens of thousands of voxel mini-blocks at 60 FPS using instanced WebGL 2.0 draw calls.
- **Multi-Pass Shading**:
  - **Pass 1**: Atmospheric volcanic sky and canyon backdrop.
  - **Pass 2**: Hardware-instanced 3D voxel mini-blocks with material-specific lighting, AO, and temperature glow.
  - **Pass 3**: Additive volumetric magma glow halos and embers.
- **Interactive Controls**:
  - **Orbit / Pan / Zoom**: Smooth mouse drag and scroll wheel navigation.
  - **Architectural Cross-Section Sliders**: Slice X and Slice Y clipping planes to inspect internal conduits and magma chambers.
  - **Layer Isolation**: Filter by structural zones (Cone, Caldera, Walls, Cathedral, Flora, Arcane Crystals).
  - **Atmospheric Themes**: Volcanic Dusk, Midnight Ashfall, Golden Dawn, and Blueprint / Wireframe modes.
  - **Voxel Inspector**: Hover over any voxel to inspect coordinates, material class, thermal readings, and structural zone.

---

## 🎮 Navigation & Keyboard Controls

| Control | Action |
| :--- | :--- |
| **Left Click + Drag** | Orbit camera (Yaw / Pitch) |
| **Right Click + Drag** | Pan camera target |
| **Scroll Wheel** | Zoom in / out |
| **Preset Buttons** | Snap to curated architectural viewpoints |
| **Cross-Section Sliders** | Cut through internal geology and magma chambers |

---

## 📁 Project Structure

```
.
├── index.html                           # Main entry point for GitHub Pages
├── volcanic_sky_citadel_voxel_3d.html    # Standalone 3D observatory build
├── voxel_engine.js                      # Modular WebGL 2.0 3D Voxel Engine
└── README.md                            # Documentation and live preview link
```

---

## 🚀 Running Locally

Open `index.html` or `volcanic_sky_citadel_voxel_3d.html` directly in any modern browser supporting WebGL 2.0 (Chrome, Edge, Firefox, Safari). No build step or package manager required.
