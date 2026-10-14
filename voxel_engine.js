(() => {
    "use strict";

    // =========================================================================
    // 1. DETERMINISTIC FAST NOISE & MATH UTILITIES
    // =========================================================================
    const fract = (x) => x - Math.floor(x);
    const lerp = (a, b, t) => a + (b - a) * t;
    const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
    const smoothstep = (e0, e1, x) => {
      const t = clamp((x - e0) / (e1 - e0), 0.0, 1.0);
      return t * t * (3.0 - 2.0 * t);
    };

    function hash3(x, y, z) {
      let n = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
      n = (n ^ (n >> 13)) * 1274126177;
      return ((n ^ (n >> 16)) >>> 0) / 4294967295.0;
    }

    function noise3D(x, y, z) {
      const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
      const xf = x - xi, yf = y - yi, zf = z - zi;
      const u = xf * xf * (3.0 - 2.0 * xf);
      const v = yf * yf * (3.0 - 2.0 * yf);
      const w = zf * zf * (3.0 - 2.0 * zf);

      const n000 = hash3(xi, yi, zi);
      const n100 = hash3(xi + 1, yi, zi);
      const n010 = hash3(xi, yi + 1, zi);
      const n110 = hash3(xi + 1, yi + 1, zi);
      const n001 = hash3(xi, yi, zi + 1);
      const n101 = hash3(xi + 1, yi, zi + 1);
      const n011 = hash3(xi, yi + 1, zi + 1);
      const n111 = hash3(xi + 1, yi + 1, zi + 1);

      const x00 = n000 + (n100 - n000) * u;
      const x10 = n010 + (n110 - n010) * u;
      const x01 = n001 + (n101 - n001) * u;
      const x11 = n011 + (n111 - n011) * u;

      const y0 = x00 + (x10 - x00) * v;
      const y1 = x01 + (x11 - x01) * v;
      return y0 + (y1 - y0) * w;
    }

    function fbm3(x, y, z) {
      return 0.55 * noise3D(x, y, z) +
             0.30 * noise3D(x * 2.03, y * 2.03, z * 2.03) +
             0.15 * noise3D(x * 4.07, y * 4.07, z * 4.07);
    }

    // =========================================================================
    // 2. MATERIAL DEFINITIONS & METADATA FOR INSPECTOR
    // =========================================================================
    const MATERIALS = {
      1:  { name: "Deep Basalt Bedrock",      hex: "#261f24", temp: "42 °C" },
      2:  { name: "Craggy Volcanic Slate",    hex: "#42343a", temp: "48 °C" },
      3:  { name: "Thermal Weathered Cliff",  hex: "#6b4f47", temp: "74 °C" },
      4:  { name: "Charred Obsidian Scoria",  hex: "#1c1316", temp: "185 °C" },
      5:  { name: "Cliffside Olive Moss",     hex: "#52702f", temp: "29 °C" },
      6:  { name: "Sunlit Highland Turf",     hex: "#84a648", temp: "27 °C" },
      7:  { name: "Fortress Ashlar Masonry",  hex: "#966d54", temp: "54 °C" },
      8:  { name: "Sun-Baked Ochre Freestone",hex: "#c49673", temp: "58 °C" },
      9:  { name: "Recessed Mortar & Tracery",hex: "#684a3b", temp: "49 °C" },
      10: { name: "Gothic Spire Dark Slate",  hex: "#4c3836", temp: "44 °C" },
      11: { name: "Cooling Crimson Magma",    hex: "#ba2210", temp: "790 °C" },
      12: { name: "Molten Pyroclast Flow",    hex: "#ff5900", temp: "1,020 °C" },
      13: { name: "Incandescent Gold Magma",  hex: "#ffb700", temp: "1,180 °C" },
      14: { name: "White-Hot Magma Core",     hex: "#fff478", temp: "1,340 °C" },
      15: { name: "Arcane Crimson Octahedron",hex: "#ff3314", temp: "640 °C" },
      16: { name: "Cathedral Amber Lantern",  hex: "#ffa726", temp: "95 °C" }
    };

    const ZONES = {
      1: "Inverted Basalt Volcanic Cone",
      2: "Caldera Lake & Abyssal Lava Falls",
      3: "Outer Curtain Wall & Bastions",
      4: "Gothic Cathedral-Citadel Complex",
      5: "Outer Terraced Moss & Flora",
      6: "Arcane Red Crystal & Sky Embers"
    };

    // =========================================================================
    // 3. HIGH-DENSITY 3D VOXEL WORLD GENERATOR (144 x 310 x 144)
    // =========================================================================
    const GX = 144, GY = 310, GZ = 144;
    const OX = 72,  OY = 165, OZ = 72; // Offsets so x in [-72..71], y in [-165..144], z in [-72..71]

    const grid = new Uint8Array(GX * GY * GZ);
    const zoneGrid = new Uint8Array(GX * GY * GZ);

    function idx(x, y, z) {
      return ((y + OY) * GX + (x + OX)) * GZ + (z + OZ);
    }

    function inBounds(x, y, z) {
      return (x >= -OX && x < GX - OX && y >= -OY && y < GY - OY && z >= -OZ && z < GZ - OZ);
    }

    function setVoxel(x, y, z, mat, zone) {
      if (x < -OX || x >= GX - OX || y < -OY || y >= GY - OY || z < -OZ || z >= GZ - OZ) return;
      const i = ((y + OY) * GX + (x + OX)) * GZ + (z + OZ);
      grid[i] = mat;
      zoneGrid[i] = zone;
    }

    function getVoxel(x, y, z) {
      if (x < -OX || x >= GX - OX || y < -OY || y >= GY - OY || z < -OZ || z >= GZ - OZ) return 0;
      return grid[((y + OY) * GX + (x + OX)) * GZ + (z + OZ)];
    }

    // Helper for magma fissure centerline path on the front-right flank
    function getFissureCenter(y) {
      const t = clamp((36.0 - y) / 150.0, 0.0, 1.0);
      let profileScale;
      if (t < 0.08) profileScale = 1.01 - t * 0.65;
      else if (t < 0.42) profileScale = 0.96 - (t - 0.08) * 1.08;
      else if (t < 0.78) profileScale = 0.59 - (t - 0.42) * 0.92;
      else profileScale = Math.max(0.05, 0.26 - (t - 0.78) * 1.05);

      // Angular path down the front-right flank (matching reference lava river)
      const angle = lerp(0.98, 1.28, Math.pow(t, 0.75)) + Math.sin(y * 0.065) * 0.11;
      const radScale = (t < 0.25) ? 0.96 : (t < 0.65 ? 0.92 : 0.88);
      const cx = Math.cos(angle) * 56.0 * profileScale * radScale + Math.sin(y * 0.08) * 1.8;
      const cz = Math.sin(angle) * 52.0 * profileScale * radScale;
      return [cx, cz];
    }

    function generateVoxelWorld() {
      // -----------------------------------------------------------------------
      // PASS 1: THE INVERTED VOLCANIC BASALT CONE & SUBTERRANEAN MAGMA HEART
      // -----------------------------------------------------------------------
      for (let y = -114; y <= 41; y++) {
        // Normalized depth from top rim (t=0 at y=41, t=1 at y=-114)
        const t = (41.0 - y) / 155.0;

        // Profile curve matching reference image's craggy tapered cone
        let profileScale;
        if (t < 0.08) {
          profileScale = 1.01 - t * 0.65;
        } else if (t < 0.42) {
          profileScale = 0.96 - (t - 0.08) * 1.08;
        } else if (t < 0.78) {
          profileScale = 0.59 - (t - 0.42) * 0.92;
        } else {
          profileScale = Math.max(0.03, 0.26 - (t - 0.78) * 1.08);
        }

        const baseRx = 58.0 * profileScale;
        const baseRz = 54.0 * profileScale;
        const boundX = Math.min(68, Math.ceil(baseRx + 14));
        const boundZ = Math.min(68, Math.ceil(baseRz + 14));

        // Center drift of cone for natural asymmetry matching reference
        const coneShiftX = Math.sin(y * 0.035) * 2.2 - t * 2.0;
        const coneShiftZ = Math.cos(y * 0.03) * 1.8 + t * 4.5;

        const [fissX, fissZ] = getFissureCenter(y);

        for (let x = -boundX; x <= boundX; x++) {
          for (let z = -boundZ; z <= boundZ; z++) {
            const dx = (x - coneShiftX) / Math.max(2.5, baseRx);
            const dz = (z - coneShiftZ) / Math.max(2.5, baseRz);
            const rNorm = Math.sqrt(dx * dx + dz * dz);
            if (rNorm > 1.32) continue;

            const angle = Math.atan2(dz, dx);
            // Angular faceted crags & vertical basalt columns
            const facet1 = Math.sin(angle * 7.0 + y * 0.025) * 0.085;
            const facet2 = Math.abs(Math.cos(angle * 4.5 - y * 0.04)) * 0.095;
            const strata = Math.sin(y * 0.34 + noise3D(x * 0.08, y * 0.05, z * 0.08) * 2.5) * 0.045;
            const cragNoise = (fbm3(x * 0.055, y * 0.045, z * 0.055) - 0.5) * 0.32;

            // Prominent overhang ledges at y ≈ 12, y ≈ -18, y ≈ -48
            const ledgeBoost =
              0.06 * Math.exp(-Math.pow((y - 14) / 7.0, 2)) +
              0.07 * Math.exp(-Math.pow((y + 18) / 8.0, 2)) +
              0.06 * Math.exp(-Math.pow((y + 52) / 7.0, 2));

            // Dampen crag noise near the top rim (t < 0.12) so the plateau meets the curtain wall & mossy rim cleanly
            const rimDamp = smoothstep(0.0, 0.14, t);
            const maxR = 0.94 + (facet1 + facet2 + strata + cragNoise + ledgeBoost) * rimDamp;

            if (rNorm <= maxR) {
              // Check subterranean magma chamber & central volcanic conduit
              const chamberDist = Math.sqrt(Math.pow(x - 2, 2) + Math.pow(z - 4, 2));
              const chamberRad = 6.5 + Math.sin(y * 0.11) * 3.2 + (y > 0 ? (y / 41.0) * 14.0 : 0.0);

              if (y > -82 && y < 39 && chamberDist < chamberRad) {
                if (chamberDist < chamberRad * 0.48) {
                  setVoxel(x, y, z, 14, 2);
                } else if (chamberDist < chamberRad * 0.78) {
                  setVoxel(x, y, z, 13, 2);
                } else {
                  setVoxel(x, y, z, 12, 2);
                }
                continue;
              }

              // Check Great Magma Fissure along the front-right exterior cliff face (z > 0)
              // Angular centerline winds from angle=0.92 (front-right rim) down to angle=1.35 (bottom tip)
              const targetAngle = lerp(0.92, 1.32, Math.pow(t, 0.72)) + Math.sin(y * 0.07) * 0.08;
              const angDiff = Math.abs(angle - targetAngle);
              const arcDist = angDiff * Math.max(8.0, baseRx * maxR);
              const surfDepth = (maxR - rNorm) * Math.max(10.0, baseRx);

              // Width starts as a 3.5-voxel crack under the mossy rim (y=35) and widens into a 13-voxel magma gorge
              let fissHalfWidth = 1.9 + 4.8 * Math.pow(clamp((36.0 - y) / 130.0, 0.0, 1.0), 0.62);
              if (y < -10 && y > -78) fissHalfWidth += 2.2 * Math.sin(((-10 - y) / 68.0) * Math.PI);

              if (y <= 35 && z > 0 && arcDist <= fissHalfWidth && surfDepth <= 6.5) {
                // Carve shallow 1-voxel canyon lip so the magma sits inside a rocky gorge but is 100% visible
                if (surfDepth < 0.85 && arcDist < fissHalfWidth * 0.70) {
                  continue;
                }
                // Dark crag island splitting the lower cascade (-92 < y < -56)
                const isSplitRock = (y < -56 && y > -90 && arcDist < 1.8 && Math.sin(y * 0.22 + x * 0.15) > 0.15);
                if (isSplitRock) {
                  setVoxel(x, y, z, 4, 1);
                } else if (arcDist < fissHalfWidth * 0.35) {
                  setVoxel(x, y, z, 14, 2); // Blinding white-yellow core
                } else if (arcDist < fissHalfWidth * 0.62) {
                  setVoxel(x, y, z, 13, 2); // Bright gold magma
                } else if (arcDist < fissHalfWidth * 0.82) {
                  setVoxel(x, y, z, 12, 2); // Fiery orange magma
                } else if (arcDist < fissHalfWidth * 0.93) {
                  setVoxel(x, y, z, 11, 2); // Crimson cooling edge
                } else {
                  setVoxel(x, y, z, 4, 1);  // Charred scoria canyon wall
                }
                continue;
              }

              // Secondary left-front glowing magma window (-84 < y < -64, x ≈ -8, z > 4)
              const distLeftVent = Math.sqrt(Math.pow(x + 8.5, 2) + Math.pow((y + 73) * 0.55, 2));
              if (z > 4 && distLeftVent < 4.5 && rNorm > maxR - 0.25) {
                if (distLeftVent < 2.1) setVoxel(x, y, z, 14, 2);
                else if (distLeftVent < 3.3) setVoxel(x, y, z, 13, 2);
                else setVoxel(x, y, z, 12, 2);
                continue;
              }

              // Assign rock material based on elevation, radial exposure, and noise
              const nVal = noise3D(x * 0.14, y * 0.14, z * 0.14);
              let rockMat = 1;
              if (y > 24) {
                rockMat = nVal > 0.42 ? 3 : 2;
              } else if (y > -35) {
                rockMat = (x > 4 && z > 4 && nVal > 0.38) ? 3 : (nVal > 0.46 ? 2 : 1);
              } else {
                rockMat = nVal > 0.62 ? 2 : 1;
              }
              setVoxel(x, y, z, rockMat, 1);
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // PASS 2: ABYSSAL LAVA WATERFALL PLUMES & CASCADING STREAMS (Y = -98..-162)
      // -----------------------------------------------------------------------
      const streams = [
        { ox:  1.5, oz:  6.0, topY: -96,  botY: -162, rad: 3.4 }, // Main central blinding stream
        { ox: -2.5, oz:  7.5, topY: -100, botY: -154, rad: 2.5 }, // Left fork stream
        { ox:  5.5, oz:  8.2, topY: -92,  botY: -146, rad: 2.4 }, // Right fork stream
        { ox:  8.8, oz: 11.0, topY: -78,  botY: -124, rad: 1.8 }, // Upper-right side curtain
        { ox: -5.2, oz:  8.8, topY: -104, botY: -138, rad: 1.6 }  // Far-left drip stream
      ];

      for (const st of streams) {
        for (let y = st.botY; y <= st.topY; y++) {
          const prog = (st.topY - y) / (st.topY - st.botY); // 0 at top, 1 at bottom tip
          const taper = (1.0 - Math.pow(prog, 1.35)) * st.rad;
          const swayX = st.ox + Math.sin(y * 0.14 + st.ox) * 0.85;
          const swayZ = st.oz + Math.cos(y * 0.12 + st.oz) * 0.65;
          const rCeil = Math.ceil(taper + 1.5);

          for (let dx = -rCeil; dx <= rCeil; dx++) {
            for (let dz = -rCeil; dz <= rCeil; dz++) {
              const x = Math.round(swayX + dx);
              const z = Math.round(swayZ + dz);
              const d = Math.sqrt(dx * dx + dz * dz) + (hash3(x, y, z) - 0.5) * 0.65;
              if (d <= taper) {
                if (d < taper * 0.52 || prog > 0.65) {
                  setVoxel(x, y, z, 14, 2); // Blinding white-yellow core
                } else if (d < taper * 0.82) {
                  setVoxel(x, y, z, 13, 2); // Bright gold magma
                } else {
                  setVoxel(x, y, z, 12, 2); // Fiery orange edge
                }
              }
            }
          }
        }
      }

      // Falling molten droplets around the lower waterfall (-162.. -85)
      for (let i = 0; i < 110; i++) {
        const dy = -85 - Math.floor(hash3(i, 11, 23) * 76);
        const dx = Math.round((hash3(i, 31, 47) - 0.42) * 22);
        const dz = Math.round(3 + (hash3(i, 59, 71) - 0.35) * 16);
        const mat = hash3(i, 83, 97) > 0.45 ? 14 : 13;
        setVoxel(dx, dy, dz, mat, 2);
        if (hash3(i, 19, 29) > 0.4) setVoxel(dx, dy + 1, dz, mat, 2);
      }

      // -----------------------------------------------------------------------
      // PASS 3: TOP PLATEAU MOSSY RIM TERRACES & CALDERA MOLTEN LAVA LAKE
      // -----------------------------------------------------------------------
      for (let x = -64; x <= 64; x++) {
        for (let z = -60; z <= 60; z++) {
          const dx = x / 57.0;
          const dz = z / 53.0;
          const rNorm = Math.sqrt(dx * dx + dz * dz);
          if (rNorm > 1.15) continue;

          const angle = Math.atan2(dz, dx);
          const rimNoise = (fbm3(x * 0.06, 40 * 0.06, z * 0.06) - 0.5) * 0.16;
          const effR = rNorm + rimNoise;

          // 3A. Outer Mossy Ledges & Cliff Flora (outside the curtain wall: effR in 0.86 .. 1.03)
          if (effR >= 0.855 && effR <= 1.03) {
            const stepDrop = Math.floor((effR - 0.855) * 38.0);
            const topY = 41 - stepDrop + Math.round((noise3D(x * 0.12, 0, z * 0.12) - 0.5) * 2.5);
            for (let y = topY - 4; y < topY; y++) {
              setVoxel(x, y, z, 3, 1);
            }
            const mossChance = noise3D(x * 0.11 + 5, 12, z * 0.11 - 3);
            if (mossChance > 0.22) {
              const mossMat = (mossChance > 0.52 || (x > 10 && z > 0)) ? 6 : 5;
              setVoxel(x, topY, z, mossMat, 5);
              if (mossChance > 0.65) {
                setVoxel(x, topY + 1, z, 6, 5);
              }
              if (effR > 0.94 && hash3(x, topY, z) > 0.62) {
                const vineLen = 2 + Math.floor(hash3(x, z, 7) * 4);
                for (let vy = 1; vy <= vineLen; vy++) {
                  setVoxel(x, topY - vy, z, 5, 5);
                }
              }
            } else {
              setVoxel(x, topY, z, 3, 1);
            }
          }

          // 3B. Expansive Inner Caldera Molten Lava Lake (effR < 0.825)
          if (effR < 0.825) {
            for (let y = 38; y <= 41; y++) {
              setVoxel(x, y, z, 4, 1);
            }
            const flow = fbm3(x * 0.085 + 2.3, 1.5, z * 0.085 - 1.7);
            const wallProx = 0.825 - effR;
            const frontLagoonBoost = (z > 2 && x < 18) ? 0.16 : 0.06;
            const heat = flow + frontLagoonBoost;

            let lavaMat = 12;
            if (wallProx < 0.028) {
              lavaMat = 11;
            } else if (heat > 0.60 && wallProx > 0.05) {
              lavaMat = 14; // Blazing yellow-white magma core
            } else if (heat > 0.42) {
              lavaMat = 13; // Golden magma
            } else if (heat < 0.20 && hash3(x, 42, z) > 0.45) {
              lavaMat = 4;  // Cooled crust island
            } else if (heat < 0.28) {
              lavaMat = 11;
            } else {
              lavaMat = 12;
            }
            setVoxel(x, 42, z, lavaMat, 2);
            setVoxel(x, 43, z, lavaMat, 2);
          }
        }
      }

      // -----------------------------------------------------------------------
      // PASS 4: OUTER FORTIFIED CURTAIN WALL, BASTIONS & EXTERIOR STAIRCASES
      // -----------------------------------------------------------------------
      for (let x = -60; x <= 60; x++) {
        for (let z = -56; z <= 56; z++) {
          const dx = x / 57.0;
          const dz = z / 53.0;
          const rNorm = Math.sqrt(dx * dx + dz * dz);
          const angle = Math.atan2(dz, dx);
          const rimNoise = (fbm3(x * 0.06, 40 * 0.06, z * 0.06) - 0.5) * 0.08;
          const effR = rNorm + rimNoise;

          // Curtain Wall Ring near the outer plateau rim (effR between 0.815 and 0.875)
          if (effR >= 0.815 && effR <= 0.875) {
            const wallBaseY = 37;
            const wallTopY = (z > 8) ? 46 : 49;

            // Periodic vertical buttresses & recessed blind arches every ~12 degrees
            const archPhase = fract((angle + Math.PI) / (Math.PI * 2.0) * 32.0);
            const isButtress = (archPhase < 0.28 || archPhase > 0.72);
            const isOuterFace = (effR > 0.850);
            const isInnerFace = (effR < 0.830);

            for (let y = wallBaseY; y <= wallTopY; y++) {
              // Recessed blind arch on outer face
              if (isOuterFace && !isButtress && y >= 41 && y <= 47) {
                if (effR > 0.862) continue; // Carve recessed arch depth
                setVoxel(x, y, z, 9, 3);    // Dark mortar shadow inside arch
                continue;
              }
              const nStone = hash3(x, y, z);
              let sMat = 7;
              if (y === wallTopY || (isButtress && isOuterFace)) {
                sMat = nStone > 0.35 ? 8 : 7;
              } else if (y <= 41 && isInnerFace) {
                sMat = 4; // Scorched base touching the lava moat
              } else {
                sMat = nStone > 0.68 ? 8 : (nStone < 0.22 ? 9 : 7);
              }
              setVoxel(x, y, z, sMat, 3);
            }

            // Crenellated Battlements (Merlons) along outer & inner edges of wall top
            if (isOuterFace || isInnerFace) {
              const merlonPhase = fract((angle + Math.PI) / (Math.PI * 2.0) * 48.0);
              if (merlonPhase < 0.52) {
                setVoxel(x, wallTopY + 1, z, 8, 3);
                if (isOuterFace) setVoxel(x, wallTopY + 2, z, 8, 3);
              }
            }
          }
        }
      }

      // 4B. Front-Right Sloped Stone Glacis / Bastion Apron on the OUTER Curtain Wall (X = 12..26, Z = 38..48)
      for (let x = 12; x <= 26; x++) {
        for (let z = 38; z <= 48; z++) {
          const progZ = (z - 38) / 10.0;
          const topY = Math.round(47 - progZ * 9.0);
          for (let y = 35; y <= topY; y++) {
            const isBorder = (x === 12 || x === 13 || x === 25 || x === 26);
            const mat = isBorder ? 8 : ((y === topY) ? ((x + z) % 2 === 0 ? 8 : 7) : 7);
            setVoxel(x, y, z, mat, 3);
          }
          if (z >= 38 && z <= 40 && (x <= 14 || x >= 24)) {
            for (let y = topY + 1; y <= 50; y++) {
              setVoxel(x, y, z, 8, 3);
            }
          }
        }
      }

      // 4C. Front-Left Projecting Circular Bastion on the OUTER Curtain Wall (X = -26, Z = 39)
      const bastCX = -26, bastCZ = 39;
      for (let x = bastCX - 6; x <= bastCX + 6; x++) {
        for (let z = bastCZ - 6; z <= bastCZ + 6; z++) {
          const d = Math.sqrt(Math.pow(x - bastCX, 2) + Math.pow(z - bastCZ, 2));
          if (d <= 5.6) {
            for (let y = 35; y <= 50; y++) {
              const ang = Math.atan2(z - bastCZ, x - bastCX);
              const isSlit = (y >= 43 && y <= 47 && d > 4.4 && Math.abs(Math.sin(ang * 4.0)) < 0.22);
              setVoxel(x, y, z, isSlit ? 9 : ((d > 4.6 && y % 3 === 0) ? 8 : 7), 3);
            }
            if (d >= 4.4 && d <= 5.6 && ((x + z) % 2 === 0)) {
              setVoxel(x, 51, z, 8, 3);
            }
          }
        }
      }

      // Stepped Stone Staircase descending along the outer cliff ledge from the Front-Left Bastion
      for (let step = 0; step <= 11; step++) {
        const sx = -21 + step;
        const sy = 45 - Math.floor(step * 0.65);
        for (let z = 42; z <= 46; z++) {
          for (let y = 35; y <= sy; y++) {
            setVoxel(sx, y, z, (y === sy) ? 8 : 7, 3);
          }
          if (z === 46) {
            setVoxel(sx, sy + 1, z, 8, 3);
          }
        }
      }

      // 4D. Low Inner Caldera Containment Wall on the front-right (leaves the main lava lake wide open!)
      for (let t = 0; t <= 22; t++) {
        const wx = Math.round(8 + t * 0.85);
        const wz = Math.round(24 + (22 - t) * 0.55);
        for (let y = 41; y <= 45; y++) {
          setVoxel(wx, y, wz, y === 45 ? 8 : 7, 3);
          setVoxel(wx + 1, y, wz, y === 45 ? 8 : 7, 3);
        }
      }

      // -----------------------------------------------------------------------
      // PASS 5: ARCHITECTURAL BUILDING BLOCK HELPERS FOR THE GOTHIC CITADEL
      // -----------------------------------------------------------------------
      function buildGothicBox(x0, x1, z0, z1, y0, y1, zoneId, hasWindows = true, hasBattlements = true) {
        for (let x = x0; x <= x1; x++) {
          for (let z = z0; z <= z1; z++) {
            const onXFace = (x === x0 || x === x1);
            const onZFace = (z === z0 || z === z1);
            const isCorner = (Math.abs(x - x0) <= 1 || Math.abs(x - x1) <= 1) &&
                             (Math.abs(z - z0) <= 1 || Math.abs(z - z1) <= 1);
            const isSurfaceWall = (x <= x0 + 1 || x >= x1 - 1 || z <= z0 + 1 || z >= z1 - 1);

            for (let y = y0; y <= y1; y++) {
              if (!isSurfaceWall && y < y1 - 1 && y > y0 + 1) {
                // Solid architectural core & vaulted halls so windows never leak sky through the building
                const isVaultArch = ((x + z) % 4 === 0) || (y % 6 === 0);
                setVoxel(x, y, z, isVaultArch ? 7 : 9, zoneId);
                continue;
              }

              // Corner stepped buttresses
              if (isCorner) {
                setVoxel(x, y, z, (y % 4 === 0) ? 8 : 7, zoneId);
                continue;
              }

              // Pointed Gothic Lancet Windows along facades
              if (hasWindows && y >= y0 + 5 && y <= y1 - 5 && (onXFace || onZFace)) {
                const coord = onZFace ? (x - x0) : (z - z0);
                const span = onZFace ? (x1 - x0) : (z1 - z0);
                if (coord >= 3 && coord <= span - 3) {
                  const bay = coord % 5;
                  if (bay === 2 || bay === 3) {
                    const isArchTop = (y === y1 - 5 && bay === 3);
                    if (!isArchTop) {
                      // Carve outer window recess and place glowing interior lantern/shadow
                      continue;
                    }
                  } else if (bay === 0) {
                    // Projecting vertical mullion / pilaster
                    setVoxel(x, y, z, 8, zoneId);
                    continue;
                  }
                }
              }

              // Inner window layer (1 voxel behind facade) glows warmly or shows dark tracery
              if (hasWindows && y >= y0 + 5 && y <= y1 - 6 && !onXFace && !onZFace && isSurfaceWall) {
                const coord = (z === z0 + 1 || z === z1 - 1) ? (x - x0) : (z - z0);
                const bay = coord % 5;
                if (bay === 2 || bay === 3) {
                  const glowChance = hash3(x, y, z);
                  setVoxel(x, y, z, glowChance > 0.35 ? 16 : 9, zoneId);
                  continue;
                }
              }

              // Horizontal cornice bands
              if (y === y1 || y === y0 + 3 || y === Math.floor((y0 + y1) * 0.55)) {
                setVoxel(x, y, z, 8, zoneId);
              } else {
                const h = hash3(x, y, z);
                setVoxel(x, y, z, h > 0.65 ? 8 : (h < 0.20 ? 9 : 7), zoneId);
              }
            }

            // Battlements & Corner Pinnacles on top of keep
            if (hasBattlements && (onXFace || onZFace)) {
              if ((x + z) % 2 === 0) {
                setVoxel(x, y1 + 1, z, 8, zoneId);
                setVoxel(x, y1 + 2, z, 8, zoneId);
              }
              if (isCorner) {
                for (let py = 1; py <= 5; py++) {
                  setVoxel(x, y1 + py, z, py >= 4 ? 8 : 7, zoneId);
                }
              }
            }
          }
        }
      }

      // Helper for tapered Gothic Spire / Pyramid Roof with corner crockets
      function buildGothicSpire(cx, cz, baseRadius, yStart, yEnd, roofMat = 10, trimMat = 8, zoneId = 4) {
        const height = yEnd - yStart;
        for (let y = yStart; y <= yEnd; y++) {
          const t = (y - yStart) / height; // 0 at base, 1 at needle tip
          const r = Math.max(0.4, baseRadius * Math.pow(1.0 - t, 0.86));
          const rInt = Math.ceil(r + 1);
          for (let dx = -rInt; dx <= rInt; dx++) {
            for (let dz = -rInt; dz <= rInt; dz++) {
              // Octagonal gothic spire metric
              const ax = Math.abs(dx), az = Math.abs(dz);
              const octDist = Math.max(ax, az, (ax + az) * 0.72);
              if (octDist <= r) {
                const isEdgeRib = (Math.abs(ax - az) <= 0.8 || ax === 0 || az === 0) && (octDist >= r - 0.9);
                const isCrocket = isEdgeRib && (y % 4 === 0) && t < 0.85;
                const mat = (t > 0.88 || isEdgeRib) ? trimMat : roofMat;
                setVoxel(cx + dx, y, cz + dz, mat, zoneId);
                if (isCrocket && octDist >= r - 0.6) {
                  setVoxel(cx + dx + Math.sign(dx), y, cz + dz + Math.sign(dz), trimMat, zoneId);
                }
              }
            }
          }
        }
      }

      // -----------------------------------------------------------------------
      // PASS 6: SCULPTING THE FULL GOTHIC CATHEDRAL-CITADEL COMPLEX
      // -----------------------------------------------------------------------
      // 6A. Far-Left Ruined Watchtowers & Western Ramparts (X = -46..-32, Z = -2..+18)
      buildGothicBox(-46, -37,  4, 15, 40, 65, 3, true, true);
      buildGothicBox(-39, -31, -6,  5, 40, 59, 3, true, true);

      // 6B. Far-Right Bastion Keep & Eastern Gatehouse (X = 31..44, Z = -2..+16)
      buildGothicBox(32, 43, 2, 14, 40, 61, 3, true, true);
      buildGothicBox(24, 34, 8, 17, 40, 53, 3, true, true);

      // 6C. Citadel Foundation Plinth & Lower Keep rising from the Caldera Lake
      // Main Front-Center Keep (X = -11..+12, Z = -16..+1, Y = 42..73) — leaves the entire foreground & left basin as a blazing sea of molten lava!
      buildGothicBox(-11, 12, -16, 1, 42, 73, 4, true, true);

      // Stepped Buttress Piers plunging into the front lava lake along Z = +2..+3
      for (let bx = -10; bx <= 10; bx += 4) {
        for (let y = 42; y <= 69; y++) {
          const depth = y < 54 ? 2 : 1;
          for (let dz = 1; dz <= depth; dz++) {
            setVoxel(bx, y, 1 + dz, (y % 5 === 0) ? 8 : 7, 4);
            setVoxel(bx + 1, y, 1 + dz, (y % 5 === 0) ? 8 : 7, 4);
          }
        }
        for (let py = 70; py <= 76; py++) {
          setVoxel(bx, py, 2, 8, 4);
        }
      }

      // 6D. Right-Wing Classical/Gothic Colonnade Palace & Grand Staircase (X = +11..+27, Z = -12..+8)
      buildGothicBox(11, 27, -12, 8, 42, 70, 4, true, true);
      buildGothicBox(13, 25, -10, 5, 70, 81, 4, true, true);
      // Monumental Stepped Entrance Staircase descending on the front-right (X = 14..24, Z = 9..20)
      for (let sz = 9; sz <= 20; sz++) {
        const stepH = 54 - (sz - 9);
        for (let sx = 14; sx <= 24; sx++) {
          for (let y = 42; y <= stepH; y++) {
            const isBalustrade = (sx === 14 || sx === 15 || sx === 23 || sx === 24);
            setVoxel(sx, y, sz, isBalustrade ? 8 : 7, 4);
          }
          if (sx === 14 || sx === 24) {
            setVoxel(sx, stepH + 1, sz, 8, 4);
            setVoxel(sx, stepH + 2, sz, 8, 4);
          }
        }
      }

      // 6E. Left-Wing Twin-Spired Gothic Cathedral & Flying Buttresses (X = -24..-8, Z = -26..-4)
      buildGothicBox(-24, -8, -26, -4, 42, 76, 4, true, true);
      // Left-Front Gothic Bell Tower (X = -17..-9, Z = -5..+3, Y = 72..86 + Spire to 103)
      buildGothicBox(-17, -9, -5, 3, 72, 86, 4, true, true);
      buildGothicSpire(-13, -1, 4.5, 87, 104, 10, 8, 4);

      // Left-Back Gothic Tower (X = -25..-17, Z = -18..-10, Y = 72..84 + Spire to 99)
      buildGothicBox(-25, -17, -18, -10, 72, 84, 4, true, true);
      buildGothicSpire(-21, -14, 4.2, 85, 99, 10, 8, 4);

      // Secondary Left-Mid Pinnacle Turret (X = -7..-1, Z = -16..-10, Y = 70..94)
      buildGothicBox(-7, -1, -16, -10, 68, 86, 4, true, true);
      buildGothicSpire(-4, -13, 3.5, 87, 98, 10, 8, 4);

      // 6F. Far-Right Slender Octagonal Watch-Turret (X = +25..+33, Z = -16..-8)
      // Matches the distinct slender spire on the far right of the castle silhouette!
      buildGothicBox(25, 32, -16, -9, 41, 79, 4, true, true);
      buildGothicSpire(28, -12, 3.8, 80, 96, 10, 8, 4);

      // 6G. Rear & Mid-Upper Cathedral Clerestory & Transepts (X = -10..+18, Z = -28..-5, Y = 41..85)
      buildGothicBox(-10, 18, -26, -5, 41, 84, 4, true, true);
      // Pitched Gothic Nave Roof along Z = -25..-6
      for (let z = -25; z <= -6; z++) {
        for (let r = 0; r <= 7; r++) {
          setVoxel(-7 + r, 85 + r, z, 10, 4);
          setVoxel( 7 - r, 85 + r, z, 10, 4);
          if (r === 7) setVoxel(0, 92, z, 8, 4); // Roof ridge cresting
        }
      }

      // 3D Flying Buttresses leaping from outer piers to the central cathedral clerestory!
      const buttressZList = [-22, -16, -10, -4];
      for (const bz of buttressZList) {
        // Left & Right outer buttress piers
        for (let y = 55; y <= 84; y++) {
          setVoxel(-14, y, bz, 8, 4);
          setVoxel(-14, y, bz + 1, 7, 4);
          setVoxel( 20, y, bz, 8, 4);
          setVoxel( 20, y, bz + 1, 7, 4);
        }
        // Flying arch flyers
        for (let s = 0; s <= 6; s++) {
          const fy = 72 + Math.round(s * 1.6 + Math.sin((s / 6.0) * Math.PI) * 2.0);
          setVoxel(-14 + s, fy, bz, 8, 4);
          setVoxel( 20 - s, fy, bz, 8, 4);
        }
      }

      // 6H. THE SOARING GRAND CENTRAL CATHEDRAL SPIRE (X = 0..+16, Z = -22..-6, Y = 41..138)
      // Lower & Mid Belfry Shaft (Y = 76..100)
      buildGothicBox(0, 16, -22, -6, 76, 100, 4, true, true);

      // Attached Western Bell-Turret & Bridge Arch (matching the stepped twin-peak base of the main spire!)
      buildGothicBox(-4, 2, -18, -10, 80, 103, 4, true, true);
      buildGothicSpire(-1, -14, 3.2, 104, 113, 10, 8, 4);

      // Upper Octagonal Lantern Stage of the Grand Spire (Y = 100..110)
      buildGothicBox(2, 14, -20, -8, 100, 110, 4, true, true);

      // Four Tall Corner Pinnacles framing the Grand Spire at Y = 100..112
      const corners = [[1, -21], [15, -21], [1, -7], [15, -7]];
      for (const [px, pz] of corners) {
        for (let y = 100; y <= 111; y++) {
          setVoxel(px, y, pz, y >= 108 ? 8 : 7, 4);
          if (y <= 106) {
            setVoxel(px + (px < 8 ? 1 : -1), y, pz, 7, 4);
            setVoxel(px, y, pz + (pz < -14 ? 1 : -1), 7, 4);
          }
        }
      }

      // The Needle-Sharp Grand Gothic Spire (Y = 110..138)
      buildGothicSpire(8, -14, 6.2, 110, 138, 10, 8, 4);
      // Golden Finial Cross at the very apex (Y = 139..141)
      setVoxel(8, 139, -14, 8, 4);
      setVoxel(8, 140, -14, 8, 4);
      setVoxel(7, 139, -14, 8, 4);
      setVoxel(9, 139, -14, 8, 4);

      // -----------------------------------------------------------------------
      // PASS 7: FLOATING ARCANE RED OCTAHEDRON, SHARDS & SKY EMBERS
      // -----------------------------------------------------------------------
      // 7A. The Floating Red Octahedron Crystal (X = +31, Y = +118, Z = -6)
      const cryX = 31, cryY = 118, cryZ = -6;
      for (let dx = -6; dx <= 6; dx++) {
        for (let dy = -6; dy <= 6; dy++) {
          for (let dz = -6; dz <= 6; dz++) {
            const octMetric = Math.abs(dx) + Math.abs(dy) * 1.15 + Math.abs(dz);
            if (octMetric <= 5.4) {
              const isCore = octMetric <= 2.4;
              setVoxel(cryX + dx, cryY + dy, cryZ + dz, isCore ? 14 : 15, 6);
            }
          }
        }
      }

      // 7B. Swirling Arcane Red Shard Cluster between the Eastern Turret and the Octahedron
      for (let i = 0; i < 62; i++) {
        const t = i / 62.0;
        const sx = Math.round(lerp(22, 33, t) + (hash3(i, 1, 2) - 0.5) * 14.0);
        const sy = Math.round(lerp(88, 114, t) + (hash3(i, 3, 4) - 0.5) * 10.0);
        const sz = Math.round(lerp(-12, -2, t) + (hash3(i, 5, 6) - 0.5) * 12.0);
        const mat = hash3(i, 7, 8) > 0.72 ? 13 : 15;
        setVoxel(sx, sy, sz, mat, 6);
        if (hash3(i, 9, 10) > 0.55) setVoxel(sx + 1, sy, sz, 15, 6);
      }

      // 7C. Levitating Upper-Left Volcanic Pebble Fragment (visible in reference sky at X ≈ -38, Y ≈ +106)
      const pebX = -38, pebY = 106, pebZ = 6;
      for (let dx = -2; dx <= 2; dx++) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dz = -2; dz <= 2; dz++) {
            if (dx*dx + dy*dy + dz*dz <= 4.5) {
              setVoxel(pebX + dx, pebY + dy, pebZ + dz, 2, 6);
            }
          }
        }
      }

      // 7D. Atmospheric Rising Magma Embers around the Sky & Waterfall
      for (let i = 0; i < 160; i++) {
        const ex = Math.round((hash3(i, 101, 13) - 0.5) * 124);
        const ey = Math.round(-150 + hash3(i, 103, 17) * 285);
        const ez = Math.round((hash3(i, 107, 19) - 0.5) * 116);
        if (getVoxel(ex, ey, ez) === 0) {
          const emat = hash3(i, 109, 23) > 0.5 ? 15 : 13;
          setVoxel(ex, ey, ez, emat, 6);
        }
      }
    }

    // =========================================================================
    // 4. EXTRACT VISIBLE SURFACE & CUT-PLANE INSTANCES WITH 3D VOXEL AO
    // =========================================================================
    // We allocate reusable Float32Arrays for up to 320,000 visible mini-blocks
    const MAX_INSTANCES = 320000;
    const instanceData1 = new Float32Array(MAX_INSTANCES * 4); // x, y, z, materialId
    const instanceData2 = new Float32Array(MAX_INSTANCES * 4); // ao, lavaLight, colorNoise, zoneId
    let activeInstanceCount = 0;
    let totalMagmaVoxels = 0;

    function extractSurfaceVoxels(sliceX = 72, sliceY = 144) {
      let count = 0;
      let magmaCount = 0;

      for (let y = -OY + 1; y <= Math.min(GY - OY - 2, sliceY); y++) {
        const yOff = (y + OY) * GX;
        const onSliceY = (y === sliceY && sliceY < 144);

        for (let x = -OX + 1; x <= Math.min(GX - OX - 2, sliceX); x++) {
          const xyOff = (yOff + (x + OX)) * GZ;
          const onSliceX = (x === sliceX && sliceX < 72);

          for (let z = -OZ + 1; z < GZ - OZ - 1; z++) {
            const i = xyOff + (z + OZ);
            const mat = grid[i];
            if (mat === 0) continue;

            // Check 6-connected neighbors for surface visibility or slice boundary
            const isSurface =
              onSliceX || onSliceY ||
              grid[i - 1] === 0 ||
              grid[i + 1] === 0 ||
              grid[i - GZ] === 0 ||
              grid[i + GZ] === 0 ||
              grid[i - GX * GZ] === 0 ||
              grid[i + GX * GZ] === 0;

            if (!isSurface) continue;
            if (count >= MAX_INSTANCES) break;

            // Compute fast 3D Voxel Ambient Occlusion from 18 surrounding neighbors
            let occ = 0;
            const strideY = GX * GZ;
            const strideX = GZ;
            if (grid[i + strideY] !== 0) occ += 2;
            if (grid[i + strideY + strideX] !== 0) occ += 1;
            if (grid[i + strideY - strideX] !== 0) occ += 1;
            if (grid[i + strideY + 1] !== 0) occ += 1;
            if (grid[i + strideY - 1] !== 0) occ += 1;
            if (grid[i + strideX + 1] !== 0) occ += 1;
            if (grid[i + strideX - 1] !== 0) occ += 1;
            if (grid[i - strideX + 1] !== 0) occ += 1;
            if (grid[i - strideX - 1] !== 0) occ += 1;

            const ao = clamp(1.0 - (occ / 13.0) * 0.62, 0.34, 1.0);

            // Compute analytical Magma Bounce Light proximity (from caldera y≈40 & fissure canyon)
            let lavaLight = 0.0;
            // 1) Caldera lake bounce light onto lower castle walls & inner curtain walls
            if (y >= 38 && y <= 84) {
              const rCaldera = Math.sqrt(x * x + z * z);
              if (rCaldera < 48.0) {
                const hDist = Math.max(0.0, y - 40.0);
                lavaLight += Math.exp(-hDist * 0.065) * 0.85;
              }
            }
            // 2) Side fissure & bottom lava waterfall bounce light onto basalt cliffs
            if (y <= 40) {
              const [fx, fz] = getFissureCenter(Math.max(-110, y));
              const dFiss = Math.sqrt((x - fx) * (x - fx) + (z - fz) * (z - fz));
              lavaLight += Math.exp(-dFiss * 0.085) * 0.95;
            }
            lavaLight = clamp(lavaLight, 0.0, 1.25);

            const cNoise = hash3(x, y, z);
            const zId = zoneGrid[i];

            const base4 = count * 4;
            instanceData1[base4]     = x;
            instanceData1[base4 + 1] = y;
            instanceData1[base4 + 2] = z;
            instanceData1[base4 + 3] = mat;

            instanceData2[base4]     = ao;
            instanceData2[base4 + 1] = lavaLight;
            instanceData2[base4 + 2] = cNoise;
            instanceData2[base4 + 3] = zId;

            if (mat >= 11 && mat <= 15) magmaCount++;
            count++;
          }
        }
      }

      activeInstanceCount = count;
      totalMagmaVoxels = magmaCount;
      document.getElementById("stat-voxels").textContent = count.toLocaleString();
      document.getElementById("stat-magma").textContent = magmaCount.toLocaleString();
    }

    // =========================================================================
    // 5. WEBGL2 HARDWARE-INSTANCED VOXEL ENGINE & SHADERS
    // =========================================================================
    const canvas = document.getElementById("voxel-canvas");
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: false, powerPreference: "high-performance" });

    if (!gl) {
      alert("WebGL2 is required to view this high-density 3D voxel scene.");
      return;
    }

    // -------------------------------------------------------------------------
    // 5A. ATMOSPHERIC VOLCANIC SKY, VOLUMETRIC CLOUDS & CANYON BACKDROP SHADER
    // -------------------------------------------------------------------------
    const bgVertSrc = `#version 300 es
    precision highp float;
    out vec2 v_uv;
    void main() {
      vec2 pos[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
      gl_Position = vec4(pos[gl_VertexID], 0.9999, 1.0);
      v_uv = pos[gl_VertexID] * 0.5 + 0.5;
    }`;

    const bgFragSrc = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_camAngles; // yaw, pitch
    uniform int u_theme;
    out vec4 outColor;

    float hash2(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    float noise2(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(mix(hash2(i + vec2(0.0,0.0)), hash2(i + vec2(1.0,0.0)), u.x),
                 mix(hash2(i + vec2(0.0,1.0)), hash2(i + vec2(1.0,1.0)), u.x), u.y);
    }

    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.52;
      for (int i = 0; i < 5; i++) {
        v += a * noise2(p);
        p = p * 2.04 + vec2(1.7, 9.2);
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = v_uv;
      float aspect = u_resolution.x / max(1.0, u_resolution.y);
      vec2 p = vec2((uv.x - 0.5) * aspect, uv.y - 0.5);

      // Subtle parallax from camera rotation
      vec2 parallax = vec2(u_camAngles.x * 0.18, u_camAngles.y * 0.14);

      if (u_theme == 1) {
        // Midnight Magma Eclipse Mode
        vec3 sky = mix(vec3(0.16, 0.03, 0.02), vec3(0.03, 0.02, 0.05), smoothstep(0.0, 0.85, uv.y));
        float glow = exp(-length(p - vec2(0.0, -0.25)) * 2.4);
        sky += vec3(0.55, 0.12, 0.02) * glow;
        outColor = vec4(sky, 1.0);
        return;
      }
      if (u_theme == 2) {
        // Clear Architectural Daylight
        vec3 sky = mix(vec3(0.84, 0.76, 0.70), vec3(0.32, 0.36, 0.46), smoothstep(0.0, 1.0, uv.y));
        outColor = vec4(sky, 1.0);
        return;
      }
      if (u_theme == 3) {
        // Thermal Blueprint Mode
        vec3 sky = mix(vec3(0.05, 0.08, 0.16), vec3(0.02, 0.03, 0.07), uv.y);
        outColor = vec4(sky, 1.0);
        return;
      }

      // Default Theme 0: Golden Volcanic Dusk matching reference image!
      vec3 zenithCol  = vec3(0.34, 0.25, 0.27);
      vec3 midSkyCol  = vec3(0.49, 0.36, 0.35);
      vec3 lowGlowCol = vec3(0.38, 0.15, 0.11);
      vec3 abyssCol   = vec3(0.16, 0.07, 0.06);

      vec3 col = mix(abyssCol, lowGlowCol, smoothstep(0.0, 0.36, uv.y));
      col = mix(col, midSkyCol, smoothstep(0.32, 0.68, uv.y));
      col = mix(col, zenithCol, smoothstep(0.65, 1.0, uv.y));

      // Billowing Cumulus / Pyroclastic Clouds in the upper sky (matching left & right cloud banks in reference)
      if (uv.y > 0.26) {
        vec2 cUV = p * 2.4 + parallax + vec2(u_time * 0.008, 0.0);
        float cLeft  = smoothstep(0.55, 0.05, length(p - vec2(-0.32, 0.22)));
        float cRight = smoothstep(0.62, 0.05, length(p - vec2( 0.34, 0.18)));
        float n1 = fbm(cUV * 1.4);
        float n2 = fbm(cUV * 2.9 - vec2(0.4, 0.3));
        float cloudShape = smoothstep(0.36, 0.72, n1 * 0.8 + (cLeft + cRight) * 0.52) * smoothstep(0.26, 0.45, uv.y);

        // Sun-lit cream-gold top vs warm rose-taupe cloud shadow
        float lightGrad = smoothstep(0.35, 0.72, n2 + uv.y * 0.25 + p.x * 0.15);
        vec3 cloudShadow = vec3(0.46, 0.34, 0.32);
        vec3 cloudLit    = vec3(0.98, 0.89, 0.76);
        vec3 cloudColor  = mix(cloudShadow, cloudLit, lightGrad);
        col = mix(col, cloudColor, cloudShape * 0.92);
      }

      // Lower Volcanic Mountain Peaks & Glowing Canyon Abyss (matching bottom of reference image)
      if (uv.y < 0.45) {
        float m1 = 0.22 + 0.15 * abs(p.x * 1.6) + 0.06 * fbm(vec2(p.x * 4.5 + parallax.x, 1.2));
        float m2 = 0.16 + 0.12 * abs(p.x * 1.3 - 0.1) + 0.05 * fbm(vec2(p.x * 6.5 + parallax.x, 3.4));
        if (uv.y < m1) {
          vec3 ridgeCol = vec3(0.24, 0.11, 0.09);
          // Warm rim light on mountain ridges facing the central lava waterfall
          float rimGlow = exp(-abs(p.x) * 3.5) * smoothstep(m1 - 0.08, m1, uv.y);
          ridgeCol += vec3(0.55, 0.22, 0.06) * rimGlow;
          col = mix(col, ridgeCol, 0.88);
        }
        if (uv.y < m2) {
          vec3 fgRidge = vec3(0.14, 0.06, 0.06);
          // Subtle lava river veins in the bottom-right canyon valley
          float vein = smoothstep(0.76, 0.82, fbm(vec2(p.x * 14.0, uv.y * 18.0)));
          fgRidge += vec3(0.85, 0.28, 0.04) * vein * smoothstep(0.35, 0.0, abs(p.x - 0.18));
          col = mix(col, fgRidge, 0.95);
        }
      }

      // Radiant fiery atmospheric bloom around the central island & lower waterfall
      float waterfallBloom = exp(-length(vec2(p.x * 1.8, (uv.y - 0.24) * 1.3)) * 3.2);
      col += vec3(0.85, 0.32, 0.05) * waterfallBloom * 0.48;

      outColor = vec4(col, 1.0);
    }`;

    // -------------------------------------------------------------------------
    // 5B. INSTANCED 3D MINI-VOXEL VERTEX & FRAGMENT SHADERS
    // -------------------------------------------------------------------------
    const voxelVertSrc = `#version 300 es
    precision highp float;

    layout(location = 0) in vec3 a_cubePos;
    layout(location = 1) in vec3 a_cubeNormal;
    layout(location = 2) in vec2 a_cubeUV;
    layout(location = 3) in vec4 a_inst1; // x, y, z, materialId
    layout(location = 4) in vec4 a_inst2; // ao, lavaLight, colorNoise, zoneId

    uniform mat4 u_viewProj;
    uniform float u_blockScale;
    uniform float u_time;
    uniform int u_activeZone;
    uniform vec3 u_hoverVoxel;

    out vec3 v_worldPos;
    out vec3 v_normal;
    out vec2 v_uv;
    flat out int v_matId;
    flat out int v_zoneId;
    out float v_ao;
    out float v_lavaLight;
    out float v_noise;
    flat out int v_isHovered;

    void main() {
      int matId = int(a_inst1.w + 0.5);
      int zoneId = int(a_inst2.w + 0.5);

      // Layer isolation filter
      if (u_activeZone != 0 && zoneId != u_activeZone) {
        gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
        return;
      }

      vec3 gridPos = a_inst1.xyz;

      // Subtle floating animation for Zone 6 (Arcane Crystal & Sky Embers)
      if (zoneId == 6) {
        float bob = sin(u_time * 2.2 + a_inst2.z * 6.2831) * 0.85;
        gridPos.y += bob;
      }

      // Check if this exact mini-block is currently hovered by the user's cursor
      int isHovered = (
        abs(a_inst1.x - u_hoverVoxel.x) < 0.1 &&
        abs(a_inst1.y - u_hoverVoxel.y) < 0.1 &&
        abs(a_inst1.z - u_hoverVoxel.z) < 0.1
      ) ? 1 : 0;

      // Scale individual mini-block (supports Exploded Mini-Block view!)
      float scale = isHovered == 1 ? 1.18 : u_blockScale;
      vec3 worldPos = gridPos + a_cubePos * scale;

      v_worldPos = worldPos;
      v_normal = a_cubeNormal;
      v_uv = a_cubeUV;
      v_matId = matId;
      v_zoneId = zoneId;
      v_ao = a_inst2.x;
      v_lavaLight = a_inst2.y;
      v_noise = a_inst2.z;
      v_isHovered = isHovered;

      gl_Position = u_viewProj * vec4(worldPos, 1.0);
    }`;

    const voxelFragSrc = `#version 300 es
    precision highp float;

    in vec3 v_worldPos;
    in vec3 v_normal;
    in vec2 v_uv;
    flat in int v_matId;
    flat in int v_zoneId;
    in float v_ao;
    in float v_lavaLight;
    in float v_noise;
    flat in int v_isHovered;

    uniform vec3 u_camPos;
    uniform float u_time;
    uniform float u_bevelStrength;
    uniform float u_magmaIntensity;
    uniform int u_theme;

    out vec4 outColor;

    vec3 getMaterialBaseColor(int m, float n) {
      if (m == 1)  return mix(vec3(0.18, 0.15, 0.18), vec3(0.28, 0.23, 0.26), n); // Deep Basalt
      if (m == 2)  return mix(vec3(0.30, 0.24, 0.27), vec3(0.44, 0.35, 0.37), n); // Craggy Slate
      if (m == 3)  return mix(vec3(0.45, 0.34, 0.31), vec3(0.60, 0.46, 0.40), n); // Warm Cliff Rock
      if (m == 4)  return mix(vec3(0.11, 0.08, 0.10), vec3(0.21, 0.13, 0.14), n); // Charred Obsidian
      if (m == 5)  return mix(vec3(0.30, 0.44, 0.19), vec3(0.44, 0.58, 0.26), n); // Deep Olive Moss
      if (m == 6)  return mix(vec3(0.52, 0.66, 0.29), vec3(0.68, 0.80, 0.38), n); // Sunlit Highland Turf
      if (m == 7)  return mix(vec3(0.58, 0.41, 0.32), vec3(0.73, 0.53, 0.41), n); // Fortress Masonry
      if (m == 8)  return mix(vec3(0.75, 0.57, 0.44), vec3(0.90, 0.72, 0.56), n); // Ochre Freestone
      if (m == 9)  return mix(vec3(0.35, 0.24, 0.19), vec3(0.45, 0.32, 0.25), n); // Recessed Tracery
      if (m == 10) return mix(vec3(0.26, 0.19, 0.18), vec3(0.37, 0.27, 0.25), n); // Gothic Spire Slate
      if (m == 11) return mix(vec3(0.62, 0.09, 0.04), vec3(0.85, 0.18, 0.06), n); // Crimson Magma Crust
      if (m == 12) return mix(vec3(0.96, 0.28, 0.02), vec3(1.00, 0.48, 0.05), n); // Molten Orange Flow
      if (m == 13) return mix(vec3(1.00, 0.62, 0.04), vec3(1.00, 0.82, 0.14), n); // Gold Magma
      if (m == 14) return mix(vec3(1.00, 0.92, 0.38), vec3(1.00, 0.99, 0.78), n); // White-Hot Core
      if (m == 15) return mix(vec3(0.95, 0.12, 0.06), vec3(1.00, 0.42, 0.18), n); // Arcane Red Crystal
      if (m == 16) return mix(vec3(1.00, 0.56, 0.12), vec3(1.00, 0.80, 0.32), n); // Cathedral Lantern
      return vec3(0.5);
    }

    void main() {
      // 1. Compute crisp micro-block 3D bevel & edge outline on every individual voxel!
      vec2 edgeDist = min(v_uv, 1.0 - v_uv);
      float minEdge = min(edgeDist.x, edgeDist.y);
      float cornerDist = length(max(vec2(0.0), vec2(0.14) - edgeDist));

      // Perturb normal along cube edges to create authentic 3D beveled mini-blocks
      vec2 centeredUV = v_uv - 0.5;
      vec3 N = normalize(v_normal);
      float bevelMask = 1.0 - smoothstep(0.0, 0.16, minEdge);
      float edgeSeam  = 1.0 - smoothstep(0.0, 0.055 + u_bevelStrength * 0.045, minEdge);

      // Subtle micro-grain texture inside each mini-block face
      vec2 microGrid = floor(v_uv * 4.0);
      float subTex = fract(sin(dot(microGrid + v_noise * 17.0, vec2(12.9898, 78.233))) * 43758.5453);

      vec3 baseCol = getMaterialBaseColor(v_matId, v_noise);
      baseCol *= (0.95 + 0.10 * subTex);

      // Thermal Blueprint X-Ray Mode override
      if (u_theme == 3) {
        bool isHot = (v_matId >= 11 && v_matId <= 16);
        vec3 coldCol = mix(vec3(0.08, 0.22, 0.48), vec3(0.18, 0.58, 0.88), (v_worldPos.y + 150.0) / 290.0);
        vec3 hotCol  = mix(vec3(1.0, 0.25, 0.05), vec3(1.0, 0.96, 0.55), float(v_matId - 10) / 6.0);
        baseCol = isHot ? hotCol : coldCol;
      }

      // 2. Emissive Magma, Arcane Crystal & Lantern Shaders
      if (v_matId >= 11 && v_matId <= 16) {
        float flowDir = (v_worldPos.y < 36.0) ? (u_time * 3.2) : (u_time * 1.1);
        float wave = sin(v_worldPos.x * 0.35 + v_worldPos.y * 0.28 + flowDir + v_noise * 5.0) * 0.5 + 0.5;
        vec3 hotPulse = baseCol * (0.92 + 0.28 * wave) * u_magmaIntensity;

        // Crisp glowing or dark crust bevel on magma blocks
        float magmaEdge = edgeSeam * u_bevelStrength * 0.42;
        hotPulse = mix(hotPulse, hotPulse * 0.55, magmaEdge);

        if (v_isHovered == 1) {
          hotPulse = mix(hotPulse, vec3(1.0, 1.0, 1.0), 0.45);
        }
        outColor = vec4(clamp(hotPulse, 0.0, 1.0), 1.0);
        return;
      }

      // 3. Directional Sun + Sky Hemisphere + Dynamic Flickering Magma Bounce Lighting
      vec3 sunDir = normalize(vec3(0.62, 0.72, 0.32)); // Golden sun from upper-right
      vec3 backDir = normalize(vec3(-0.55, 0.25, -0.65));

      float sunDiff = max(0.0, dot(N, sunDir));
      float backRim = max(0.0, dot(N, backDir));
      float upHem   = N.y * 0.5 + 0.5;

      vec3 sunLightCol = (u_theme == 1) ? vec3(0.22, 0.18, 0.30) :
                         (u_theme == 2) ? vec3(1.05, 0.98, 0.92) :
                                          vec3(1.08, 0.84, 0.64);
      vec3 skyAmbCol   = (u_theme == 1) ? vec3(0.08, 0.06, 0.14) :
                         (u_theme == 2) ? vec3(0.45, 0.48, 0.56) :
                                          vec3(0.34, 0.24, 0.28);

      // Flickering warm orange-gold magma bounce light from the caldera & waterfall
      float flicker = 0.94 + 0.06 * sin(u_time * 4.5 + v_worldPos.x * 0.15 + v_worldPos.y * 0.1);
      float lavaFaceBias = clamp(0.65 - 0.35 * N.y + 0.25 * N.z, 0.25, 1.15);
      vec3 magmaBounce = vec3(1.05, 0.42, 0.08) * v_lavaLight * lavaFaceBias * u_magmaIntensity * flicker;

      // Specular bevel catch-light on block edges
      vec3 V = normalize(u_camPos - v_worldPos);
      vec3 H = normalize(sunDir + V);
      float spec = pow(max(0.0, dot(N, H)), 18.0) * (0.18 + bevelMask * 0.35 * u_bevelStrength);

      vec3 litColor = baseCol * (
        skyAmbCol * (0.45 + 0.55 * upHem) +
        sunLightCol * sunDiff * 0.88 +
        vec3(0.45, 0.32, 0.38) * backRim * 0.28
      ) * v_ao + magmaBounce * baseCol * 1.45 + sunLightCol * spec * 0.28;

      // Apply crisp micro-block mortar seam & bevel highlight so individual blocks pop!
      float seamDarken = edgeSeam * u_bevelStrength * 0.72;
      float bevelHighlight = bevelMask * (1.0 - edgeSeam) * u_bevelStrength * 0.24 * (0.5 + 0.5 * N.y);
      litColor = litColor * (1.0 - seamDarken) + vec3(1.0, 0.86, 0.72) * bevelHighlight;

      // Subtle atmospheric perspective / volcanic mist on lower spire
      if (u_theme == 0) {
        float lowMist = smoothstep(10.0, -145.0, v_worldPos.y) * 0.28;
        litColor = mix(litColor, vec3(0.58, 0.22, 0.10), lowMist);
      }

      // Highlight hovered voxel block
      if (v_isHovered == 1) {
        litColor = mix(litColor, vec3(1.0, 0.95, 0.65), 0.55) + vec3(0.25, 0.18, 0.05);
      }

      // Filmic tone curve
      litColor = litColor / (1.0 + litColor * 0.18);
      outColor = vec4(clamp(litColor, 0.0, 1.0), 1.0);
    }`;

    // -------------------------------------------------------------------------
    // 5C. ADDITIVE VOLUMETRIC MAGMA BLOOM BILLBOARD SHADER
    // -------------------------------------------------------------------------
    const glowVertSrc = `#version 300 es
    precision highp float;
    layout(location = 0) in vec2 a_quad;
    layout(location = 1) in vec4 a_glowPosRad; // x, y, z, radius
    layout(location = 2) in vec4 a_glowColor;  // r, g, b, intensity

    uniform mat4 u_viewProj;
    uniform vec3 u_camRight;
    uniform vec3 u_camUp;
    uniform float u_magmaIntensity;
    uniform int u_activeZone;

    out vec2 v_uv;
    out vec4 v_col;

    void main() {
      if (u_activeZone != 0 && u_activeZone != 2 && u_activeZone != 6) {
        gl_Position = vec4(2.0, 2.0, 2.0, 0.0);
        return;
      }
      float rad = a_glowPosRad.w;
      vec3 worldPos = a_glowPosRad.xyz + (u_camRight * a_quad.x + u_camUp * a_quad.y) * rad;
      v_uv = a_quad;
      v_col = vec4(a_glowColor.rgb, a_glowColor.a * u_magmaIntensity);
      gl_Position = u_viewProj * vec4(worldPos, 1.0);
    }`;

    const glowFragSrc = `#version 300 es
    precision highp float;
    in vec2 v_uv;
    in vec4 v_col;
    out vec4 outColor;
    void main() {
      float d = length(v_uv);
      if (d > 1.0) discard;
      float falloff = pow(1.0 - d, 2.6);
      outColor = vec4(v_col.rgb * falloff * v_col.a, 1.0);
    }`;

    function compileShader(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(s));
      }
      return s;
    }

    function createProgram(vsSrc, fsSrc) {
      const p = gl.createProgram();
      gl.attachShader(p, compileShader(gl.VERTEX_SHADER, vsSrc));
      gl.attachShader(p, compileShader(gl.FRAGMENT_SHADER, fsSrc));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error("Program link error:", gl.getProgramInfoLog(p));
      }
      return p;
    }

    const bgProg    = createProgram(bgVertSrc, bgFragSrc);
    const voxelProg = createProgram(voxelVertSrc, voxelFragSrc);
    const glowProg  = createProgram(glowVertSrc, glowFragSrc);

    // -------------------------------------------------------------------------
    // 5D. UNIT CUBE GEOMETRY & INSTANCE BUFFERS
    // -------------------------------------------------------------------------
    // 24 vertices (4 per face) with exact normals and [0..1] face UVs
    const cubeVerts = new Float32Array([
      // +Z Front face
      -0.5,-0.5, 0.5,  0,0,1,  0,0,   0.5,-0.5, 0.5,  0,0,1,  1,0,   0.5, 0.5, 0.5,  0,0,1,  1,1,  -0.5, 0.5, 0.5,  0,0,1,  0,1,
      // -Z Back face
       0.5,-0.5,-0.5,  0,0,-1, 0,0,  -0.5,-0.5,-0.5,  0,0,-1, 1,0,  -0.5, 0.5,-0.5,  0,0,-1, 1,1,   0.5, 0.5,-0.5,  0,0,-1, 0,1,
      // +Y Top face
      -0.5, 0.5, 0.5,  0,1,0,  0,0,   0.5, 0.5, 0.5,  0,1,0,  1,0,   0.5, 0.5,-0.5,  0,1,0,  1,1,  -0.5, 0.5,-0.5,  0,1,0,  0,1,
      // -Y Bottom face
      -0.5,-0.5,-0.5,  0,-1,0, 0,0,   0.5,-0.5,-0.5,  0,-1,0, 1,0,   0.5,-0.5, 0.5,  0,-1,0, 1,1,  -0.5,-0.5, 0.5,  0,-1,0, 0,1,
      // +X Right face
       0.5,-0.5, 0.5,  1,0,0,  0,0,   0.5,-0.5,-0.5,  1,0,0,  1,0,   0.5, 0.5,-0.5,  1,0,0,  1,1,   0.5, 0.5, 0.5,  1,0,0,  0,1,
      // -X Left face
      -0.5,-0.5,-0.5, -1,0,0,  0,0,  -0.5,-0.5, 0.5, -1,0,0,  1,0,  -0.5, 0.5, 0.5, -1,0,0,  1,1,  -0.5, 0.5,-0.5, -1,0,0,  0,1
    ]);

    const cubeIndices = new Uint16Array([
       0, 1, 2,  0, 2, 3,
       4, 5, 6,  4, 6, 7,
       8, 9,10,  8,10,11,
      12,13,14, 12,14,15,
      16,17,18, 16,18,19,
      20,21,22, 20,22,23
    ]);

    const voxelVAO = gl.createVertexArray();
    gl.bindVertexArray(voxelVAO);

    const cubeVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, cubeVBO);
    gl.bufferData(gl.ARRAY_BUFFER, cubeVerts, gl.STATIC_DRAW);

    const cubeEBO = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, cubeEBO);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, cubeIndices, gl.STATIC_DRAW);

    // Per-vertex attributes (locations 0, 1, 2)
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);

    // Per-instance buffers (locations 3, 4)
    const instBuf1 = gl.createBuffer();
    const instBuf2 = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf1);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData1.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(3);
    gl.vertexAttribPointer(3, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(3, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, instBuf2);
    gl.bufferData(gl.ARRAY_BUFFER, instanceData2.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(4);
    gl.vertexAttribPointer(4, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(4, 1);

    function uploadInstanceBuffers() {
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf1);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData1.subarray(0, activeInstanceCount * 4));
      gl.bindBuffer(gl.ARRAY_BUFFER, instBuf2);
      gl.bufferSubData(gl.ARRAY_BUFFER, 0, instanceData2.subarray(0, activeInstanceCount * 4));
    }

    // -------------------------------------------------------------------------
    // 5E. VOLUMETRIC MAGMA BLOOM BILLBOARD SPRITES
    // -------------------------------------------------------------------------
    const glowSprites = [
      // Caldera lake glow halos
      [-18, 43,  20, 26,  1.0, 0.45, 0.06, 0.22],
      [ -4, 43,  24, 28,  1.0, 0.55, 0.08, 0.24],
      [-26, 43,   6, 22,  1.0, 0.40, 0.05, 0.18],
      [ 20, 43,  18, 20,  1.0, 0.42, 0.06, 0.16],
      // Fissure canyon glow halos
      [ 18, 12,  32, 24,  1.0, 0.45, 0.05, 0.22],
      [ 15,-18,  26, 28,  1.0, 0.50, 0.08, 0.26],
      [ 11,-48,  20, 32,  1.0, 0.55, 0.10, 0.30],
      [  6,-78,  14, 30,  1.0, 0.62, 0.14, 0.30],
      // Bottom Abyssal Waterfall blazing core glow
      [  2,-108,  8, 34,  1.0, 0.72, 0.20, 0.36],
      [  1,-132,  7, 36,  1.0, 0.80, 0.25, 0.38],
      [  1,-152,  7, 30,  1.0, 0.68, 0.18, 0.30],
      // Floating Arcane Red Octahedron glow
      [ 31, 118, -6, 18,  1.0, 0.22, 0.08, 0.38]
    ];

    const glowVAO = gl.createVertexArray();
    gl.bindVertexArray(glowVAO);

    const quadVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quadVBO);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);

    const glowPosData = new Float32Array(glowSprites.length * 4);
    const glowColData = new Float32Array(glowSprites.length * 4);
    glowSprites.forEach((g, idx) => {
      glowPosData.set(g.slice(0, 4), idx * 4);
      glowColData.set(g.slice(4, 8), idx * 4);
    });

    const glowPosVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, glowPosVBO);
    gl.bufferData(gl.ARRAY_BUFFER, glowPosData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(1, 1);

    const glowColVBO = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, glowColVBO);
    gl.bufferData(gl.ARRAY_BUFFER, glowColData, gl.STATIC_DRAW);
    gl.enableVertexAttribArray(2);
    gl.vertexAttribPointer(2, 4, gl.FLOAT, false, 16, 0);
    gl.vertexAttribDivisor(2, 1);

    const bgVAO = gl.createVertexArray();

    // =========================================================================
    // 6. CAMERA ORBIT / PAN / MACRO-ZOOM & GUIDED TOUR PRESETS
    // =========================================================================
    const PRESETS = {
      poster:    { yaw:  0.05, pitch:  0.37, dist: 470, target: [  0,   6,   0], scale: 1.00 },
      spire:     { yaw: -0.16, pitch:  0.18, dist: 108, target: [  6, 104, -13], scale: 1.00 },
      caldera:   { yaw:  0.15, pitch:  0.46, dist: 105, target: [ -8,  44,  18], scale: 1.00 },
      bastion:   { yaw: -0.35, pitch:  0.30, dist:  92, target: [-22,  45,  34], scale: 1.00 },
      colonnade: { yaw:  0.48, pitch:  0.24, dist:  98, target: [ 18,  58,   4], scale: 1.00 },
      fissure:   { yaw:  0.28, pitch:  0.10, dist: 118, target: [ 16, -24,  24], scale: 1.00 },
      falls:     { yaw:  0.10, pitch: -0.04, dist: 124, target: [  2,-118,   8], scale: 1.00 },
      crystal:   { yaw:  0.32, pitch:  0.14, dist:  68, target: [ 29, 112,  -6], scale: 1.00 },
      macro:     { yaw:  0.24, pitch:  0.34, dist:  44, target: [ 14,  50,  14], scale: 0.88 }
    };

    const cam = {
      yaw: PRESETS.poster.yaw,
      pitch: PRESETS.poster.pitch,
      dist: PRESETS.poster.dist,
      target: [...PRESETS.poster.target],
      goalYaw: PRESETS.poster.yaw,
      goalPitch: PRESETS.poster.pitch,
      goalDist: PRESETS.poster.dist,
      goalTarget: [...PRESETS.poster.target],
      pos: [0, 0, 315],
      right: [1, 0, 0],
      up: [0, 1, 0],
      forward: [0, 0, -1],
      autoOrbit: false
    };

    const state = {
      blockScale: 1.00,
      bevelStrength: 0.55,
      magmaIntensity: 1.25,
      sliceX: 72,
      sliceY: 144,
      activeZone: 0,
      theme: 0,
      hoverVoxel: [-999, -999, -999]
    };

    function applyCameraPreset(key) {
      const p = PRESETS[key];
      if (!p) return;
      cam.goalYaw = p.yaw;
      cam.goalPitch = p.pitch;
      cam.goalDist = p.dist;
      cam.goalTarget = [...p.target];

      document.querySelectorAll(".preset-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.preset === key);
      });
    }

    // Matrix math helpers (column-major 4x4)
    function perspectiveMatrix(fovRad, aspect, near, far) {
      const f = 1.0 / Math.tan(fovRad * 0.5);
      const nf = 1.0 / (near - far);
      return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, (2 * far * near) * nf, 0
      ]);
    }

    function lookAtMatrix(eye, center, up) {
      let zx = eye[0] - center[0], zy = eye[1] - center[1], zz = eye[2] - center[2];
      let len = Math.hypot(zx, zy, zz) || 1;
      zx /= len; zy /= len; zz /= len;

      let xx = up[1] * zz - up[2] * zy;
      let xy = up[2] * zx - up[0] * zz;
      let xz = up[0] * zy - up[1] * zx;
      len = Math.hypot(xx, xy, xz) || 1;
      xx /= len; xy /= len; xz /= len;

      const yx = zy * xz - zz * xy;
      const yy = zz * xx - zx * xz;
      const yz = zx * xy - zy * xx;

      cam.right = [xx, xy, xz];
      cam.up = [yx, yy, yz];
      cam.forward = [-zx, -zy, -zz];

      return new Float32Array([
        xx, yx, zx, 0,
        xy, yy, zy, 0,
        xz, yz, zz, 0,
        -(xx * eye[0] + xy * eye[1] + xz * eye[2]),
        -(yx * eye[0] + yy * eye[1] + yz * eye[2]),
        -(zx * eye[0] + zy * eye[1] + zz * eye[2]),
        1
      ]);
    }

    function multiplyMat4(a, b) {
      const out = new Float32Array(16);
      for (let c = 0; c < 4; c++) {
        for (let r = 0; r < 4; r++) {
          out[c * 4 + r] =
            a[0 * 4 + r] * b[c * 4 + 0] +
            a[1 * 4 + r] * b[c * 4 + 1] +
            a[2 * 4 + r] * b[c * 4 + 2] +
            a[3 * 4 + r] * b[c * 4 + 3];
        }
      }
      return out;
    }

    // =========================================================================
    // 7. 3D RAYCASTING FOR LIVE MINI-BLOCK HOVER & CLICK FOCUS
    // =========================================================================
    const FOV_RAD = 42.0 * Math.PI / 180.0;

    function raycastVoxel(clientX, clientY) {
      const rect = canvas.getBoundingClientRect();
      const nx = ((clientX - rect.left) / rect.width) * 2.0 - 1.0;
      const ny = 1.0 - ((clientY - rect.top) / rect.height) * 2.0;
      const aspect = rect.width / Math.max(1, rect.height);
      const tanHalfFov = Math.tan(FOV_RAD * 0.5);

      const rx = cam.forward[0] + cam.right[0] * nx * aspect * tanHalfFov + cam.up[0] * ny * tanHalfFov;
      const ry = cam.forward[1] + cam.right[1] * nx * aspect * tanHalfFov + cam.up[1] * ny * tanHalfFov;
      const rz = cam.forward[2] + cam.right[2] * nx * aspect * tanHalfFov + cam.up[2] * ny * tanHalfFov;
      const rLen = Math.hypot(rx, ry, rz) || 1.0;
      const dx = rx / rLen, dy = ry / rLen, dz = rz / rLen;

      // Step along ray inside the bounding sphere of the voxel world
      const maxSteps = 460;
      const stepSize = 0.85;
      let t = Math.max(4.0, cam.dist - 180.0);

      for (let s = 0; s < maxSteps; s++) {
        const vx = Math.round(cam.pos[0] + dx * t);
        const vy = Math.round(cam.pos[1] + dy * t);
        const vz = Math.round(cam.pos[2] + dz * t);

        if (vx <= state.sliceX && vy <= state.sliceY && inBounds(vx, vy, vz)) {
          const m = getVoxel(vx, vy, vz);
          if (m !== 0) {
            const zId = zoneGrid[idx(vx, vy, vz)];
            if (state.activeZone === 0 || zId === state.activeZone) {
              return { x: vx, y: vy, z: vz, mat: m, zone: zId };
            }
          }
        }
        t += stepSize;
      }
      return null;
    }

    function updateInspectorUI(hit) {
      if (!hit) {
        state.hoverVoxel = [-999, -999, -999];
        return;
      }
      state.hoverVoxel = [hit.x, hit.y, hit.z];
      const matInfo = MATERIALS[hit.mat] || MATERIALS[7];
      const zoneName = ZONES[hit.zone] || "Volcanic Citadel";

      document.getElementById("inspector-swatch").style.background = matInfo.hex;
      document.getElementById("inspector-mat-name").textContent = matInfo.name;
      document.getElementById("inspector-zone-name").textContent = zoneName;
      const sx = hit.x >= 0 ? `+${hit.x}` : `${hit.x}`;
      const sy = hit.y >= 0 ? `+${hit.y}` : `${hit.y}`;
      const sz = hit.z >= 0 ? `+${hit.z}` : `${hit.z}`;
      document.getElementById("inspector-xyz").textContent = `[${sx}, ${sy}, ${sz}]`;
      document.getElementById("inspector-coords").textContent = `Block #${hit.mat}`;
      document.getElementById("inspector-temp").textContent = matInfo.temp;
      const aoEst = (0.72 + 0.26 * hash3(hit.x, hit.y, hit.z)).toFixed(2);
      document.getElementById("inspector-ao").textContent = aoEst;
    }

    // =========================================================================
    // 8. INTERACTIVE MOUSE / TOUCH / UI EVENT HANDLERS
    // =========================================================================
    let isDragging = false;
    let dragMode = "orbit"; // "orbit" or "pan"
    let lastMouseX = 0, lastMouseY = 0;
    let downMouseX = 0, downMouseY = 0;

    canvas.addEventListener("contextmenu", e => e.preventDefault());

    canvas.addEventListener("pointerdown", e => {
      isDragging = true;
      lastMouseX = downMouseX = e.clientX;
      lastMouseY = downMouseY = e.clientY;
      dragMode = (e.button === 2 || e.button === 1 || e.shiftKey) ? "pan" : "orbit";
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener("pointermove", e => {
      if (!isDragging) {
        const hit = raycastVoxel(e.clientX, e.clientY);
        updateInspectorUI(hit);
        return;
      }
      const dx = e.clientX - lastMouseX;
      const dy = e.clientY - lastMouseY;
      lastMouseX = e.clientX;
      lastMouseY = e.clientY;

      if (dragMode === "orbit") {
        cam.goalYaw   -= dx * 0.0065;
        cam.goalPitch  = clamp(cam.goalPitch + dy * 0.0055, -1.35, 1.42);
      } else {
        const panScale = cam.dist * 0.0016;
        cam.goalTarget[0] -= (cam.right[0] * dx - cam.up[0] * dy) * panScale;
        cam.goalTarget[1] -= (cam.right[1] * dx - cam.up[1] * dy) * panScale;
        cam.goalTarget[2] -= (cam.right[2] * dx - cam.up[2] * dy) * panScale;
      }
    });

    canvas.addEventListener("pointerup", e => {
      isDragging = false;
      const moveDist = Math.hypot(e.clientX - downMouseX, e.clientY - downMouseY);
      if (moveDist < 4 && e.button === 0) {
        // Click on any mini-block to smoothly focus camera target onto that block!
        const hit = raycastVoxel(e.clientX, e.clientY);
        if (hit) {
          cam.goalTarget = [hit.x, hit.y, hit.z];
          updateInspectorUI(hit);
        }
      }
    });

    canvas.addEventListener("wheel", e => {
      e.preventDefault();
      const zoomFactor = Math.exp(e.deltaY * 0.0011);
      cam.goalDist = clamp(cam.goalDist * zoomFactor, 26.0, 480.0);
    }, { passive: false });

    // Camera Preset Buttons
    document.querySelectorAll(".preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        applyCameraPreset(btn.dataset.preset);
      });
    });

    // Quick Zoom & Reset Buttons
    document.getElementById("btn-zoom-in").addEventListener("click", () => {
      cam.goalDist = clamp(cam.goalDist * 0.72, 26.0, 480.0);
    });
    document.getElementById("btn-zoom-out").addEventListener("click", () => {
      cam.goalDist = clamp(cam.goalDist * 1.35, 26.0, 480.0);
    });
    document.getElementById("btn-reset-cam").addEventListener("click", () => {
      applyCameraPreset("poster");
    });

    // Auto-Orbit & Full View Toggles
    const btnAutoOrbit = document.getElementById("btn-auto-orbit");
    btnAutoOrbit.addEventListener("click", () => {
      cam.autoOrbit = !cam.autoOrbit;
      btnAutoOrbit.classList.toggle("active", cam.autoOrbit);
    });

    const btnZen = document.getElementById("btn-zen-mode");
    btnZen.addEventListener("click", () => {
      document.body.classList.toggle("zen-mode");
      btnZen.classList.toggle("active", document.body.classList.contains("zen-mode"));
    });

    // Mini-Block Scale / Exploded View Controls
    const sliderScale = document.getElementById("slider-block-scale");
    const valScale = document.getElementById("val-block-scale");
    const btnExplodeQuick = document.getElementById("btn-explode-quick");

    function setBlockScalePercent(pct) {
      sliderScale.value = pct;
      state.blockScale = pct / 100.0;
      valScale.textContent = `${pct}%`;
      document.querySelectorAll("[data-scale]").forEach(b => {
        b.classList.toggle("active", Number(b.dataset.scale) === Number(pct));
      });
      btnExplodeQuick.classList.toggle("active", pct < 95);
    }

    sliderScale.addEventListener("input", e => setBlockScalePercent(Number(e.target.value)));
    document.querySelectorAll("[data-scale]").forEach(b => {
      b.addEventListener("click", () => setBlockScalePercent(Number(b.dataset.scale)));
    });
    btnExplodeQuick.addEventListener("click", () => {
      setBlockScalePercent(state.blockScale > 0.92 ? 78 : 100);
    });

    // Bevel & Magma Sliders
    const sliderBevel = document.getElementById("slider-bevel");
    sliderBevel.addEventListener("input", e => {
      state.bevelStrength = Number(e.target.value) / 100.0;
      document.getElementById("val-bevel").textContent = state.bevelStrength.toFixed(2);
    });

    const sliderMagma = document.getElementById("slider-magma");
    sliderMagma.addEventListener("input", e => {
      state.magmaIntensity = Number(e.target.value) / 100.0;
      document.getElementById("val-magma").textContent = `${state.magmaIntensity.toFixed(2)}×`;
    });

    // Cross-Section Cutaway Sliders & Buttons
    const sliderSliceX = document.getElementById("slider-slice-x");
    const sliderSliceY = document.getElementById("slider-slice-y");

    function updateCrossSection(sx, sy) {
      state.sliceX = sx;
      state.sliceY = sy;
      sliderSliceX.value = sx;
      sliderSliceY.value = sy;
      document.getElementById("val-slice-x").textContent = sx >= 72 ? "Full (+72)" : `X ≤ ${sx}`;
      document.getElementById("val-slice-y").textContent = sy >= 144 ? "Full (+144)" : `Y ≤ ${sy}`;
      extractSurfaceVoxels(sx, sy);
      uploadInstanceBuffers();
    }

    sliderSliceX.addEventListener("input", e => updateCrossSection(Number(e.target.value), state.sliceY));
    sliderSliceY.addEventListener("input", e => updateCrossSection(state.sliceX, Number(e.target.value)));

    document.getElementById("btn-reset-slice").addEventListener("click", () => updateCrossSection(72, 144));
    document.getElementById("btn-cut-conduit").addEventListener("click", () => {
      updateCrossSection(4, 144);
      cam.goalYaw = 0.65;
      cam.goalPitch = 0.16;
      cam.goalDist = 240;
      cam.goalTarget = [0, 0, 4];
    });
    document.getElementById("btn-cut-caldera").addEventListener("click", () => {
      updateCrossSection(72, 58);
      cam.goalYaw = 0.18;
      cam.goalPitch = 0.58;
      cam.goalDist = 165;
      cam.goalTarget = [0, 42, 4];
    });

    // Structural Layer Filter Buttons
    document.querySelectorAll("[data-zone]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.activeZone = Number(btn.dataset.zone);
        document.querySelectorAll("[data-zone]").forEach(b => b.classList.toggle("active", b === btn));
      });
    });

    // Atmospheric Theme Buttons
    document.querySelectorAll("[data-theme]").forEach(btn => {
      btn.addEventListener("click", () => {
        state.theme = Number(btn.dataset.theme);
        document.querySelectorAll("[data-theme]").forEach(b => b.classList.toggle("active", b === btn));
      });
    });

    // Reference Lightbox Modal
    const refModal = document.getElementById("ref-modal");
    document.getElementById("btn-expand-ref").addEventListener("click", () => refModal.classList.add("open"));
    document.getElementById("ref-thumb-trigger").addEventListener("click", () => refModal.classList.add("open"));
    document.getElementById("btn-close-ref").addEventListener("click", () => refModal.classList.remove("open"));
    refModal.addEventListener("click", e => { if (e.target === refModal) refModal.classList.remove("open"); });

    // Expose programmatic hook for automated verification / camera tour
    window.__setVoxelTestView = (presetKey, opts = {}) => {
      if (presetKey && PRESETS[presetKey]) {
        const p = PRESETS[presetKey];
        cam.yaw = cam.goalYaw = p.yaw;
        cam.pitch = cam.goalPitch = p.pitch;
        cam.dist = cam.goalDist = p.dist;
        cam.target = [...p.target];
        cam.goalTarget = [...p.target];
        document.querySelectorAll(".preset-btn").forEach(btn => {
          btn.classList.toggle("active", btn.dataset.preset === presetKey);
        });
      }
      if (opts.blockScale !== undefined) setBlockScalePercent(opts.blockScale);
      if (opts.sliceX !== undefined || opts.sliceY !== undefined) {
        updateCrossSection(opts.sliceX ?? 72, opts.sliceY ?? 144);
      }
      if (opts.theme !== undefined) state.theme = opts.theme;
      if (opts.yaw !== undefined) cam.yaw = cam.goalYaw = opts.yaw;
      if (opts.pitch !== undefined) cam.pitch = cam.goalPitch = opts.pitch;
      if (opts.dist !== undefined) cam.dist = cam.goalDist = opts.dist;
    };

    // =========================================================================
    // 9. INITIALIZE WORLD & START 60 FPS RENDER LOOP
    // =========================================================================
    function resizeCanvas() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2.0);
      const w = Math.floor(window.innerWidth * dpr);
      const h = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    // Cache uniform locations
    const bgUniforms = {
      time: gl.getUniformLocation(bgProg, "u_time"),
      res: gl.getUniformLocation(bgProg, "u_resolution"),
      angles: gl.getUniformLocation(bgProg, "u_camAngles"),
      theme: gl.getUniformLocation(bgProg, "u_theme")
    };

    const voxUniforms = {
      viewProj: gl.getUniformLocation(voxelProg, "u_viewProj"),
      blockScale: gl.getUniformLocation(voxelProg, "u_blockScale"),
      time: gl.getUniformLocation(voxelProg, "u_time"),
      activeZone: gl.getUniformLocation(voxelProg, "u_activeZone"),
      hoverVoxel: gl.getUniformLocation(voxelProg, "u_hoverVoxel"),
      camPos: gl.getUniformLocation(voxelProg, "u_camPos"),
      bevel: gl.getUniformLocation(voxelProg, "u_bevelStrength"),
      magma: gl.getUniformLocation(voxelProg, "u_magmaIntensity"),
      theme: gl.getUniformLocation(voxelProg, "u_theme")
    };

    const glowUniforms = {
      viewProj: gl.getUniformLocation(glowProg, "u_viewProj"),
      camRight: gl.getUniformLocation(glowProg, "u_camRight"),
      camUp: gl.getUniformLocation(glowProg, "u_camUp"),
      magma: gl.getUniformLocation(glowProg, "u_magmaIntensity"),
      activeZone: gl.getUniformLocation(glowProg, "u_activeZone")
    };

    // Build the 3D voxel world on startup
    requestAnimationFrame(() => {
      generateVoxelWorld();
      extractSurfaceVoxels(72, 144);
      uploadInstanceBuffers();
      document.getElementById("loading-screen").classList.add("hidden");

      let lastTime = performance.now();
      let frameCount = 0;
      let fpsTimer = lastTime;

      function renderFrame(now) {
        const dt = Math.min(0.05, (now - lastTime) * 0.001);
        lastTime = now;
        const timeSec = now * 0.001;

        frameCount++;
        if (now - fpsTimer >= 500) {
          const fps = Math.round((frameCount * 1000) / (now - fpsTimer));
          document.getElementById("stat-fps").textContent = `${fps} FPS`;
          frameCount = 0;
          fpsTimer = now;
        }

        if (cam.autoOrbit && !isDragging) {
          cam.goalYaw += dt * 0.28;
        }

        // Smooth damping toward goal camera state
        const damp = 1.0 - Math.exp(-dt * 10.0);
        cam.yaw   = lerp(cam.yaw, cam.goalYaw, damp);
        cam.pitch = lerp(cam.pitch, cam.goalPitch, damp);
        cam.dist  = lerp(cam.dist, cam.goalDist, damp);
        cam.target[0] = lerp(cam.target[0], cam.goalTarget[0], damp);
        cam.target[1] = lerp(cam.target[1], cam.goalTarget[1], damp);
        cam.target[2] = lerp(cam.target[2], cam.goalTarget[2], damp);

        const zoomRatio = (470.0 / cam.dist).toFixed(2);
        document.getElementById("stat-zoom").textContent = `${zoomRatio}×`;

        const cosP = Math.cos(cam.pitch), sinP = Math.sin(cam.pitch);
        const cosY = Math.cos(cam.yaw),   sinY = Math.sin(cam.yaw);
        cam.pos[0] = cam.target[0] + cam.dist * cosP * sinY;
        cam.pos[1] = cam.target[1] + cam.dist * sinP;
        cam.pos[2] = cam.target[2] + cam.dist * cosP * cosY;

        resizeCanvas();
        gl.viewport(0, 0, canvas.width, canvas.height);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // PASS 1: Full-screen Atmospheric Volcanic Sky & Canyon Backdrop
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.BLEND);
        gl.useProgram(bgProg);
        gl.bindVertexArray(bgVAO);
        gl.uniform1f(bgUniforms.time, timeSec);
        gl.uniform2f(bgUniforms.res, canvas.width, canvas.height);
        gl.uniform2f(bgUniforms.angles, cam.yaw, cam.pitch);
        gl.uniform1i(bgUniforms.theme, state.theme);
        gl.drawArrays(gl.TRIANGLES, 0, 3);

        // Compute View-Projection Matrix
        const aspect = canvas.width / Math.max(1, canvas.height);
        const proj = perspectiveMatrix(FOV_RAD, aspect, 2.0, 1200.0);
        const view = lookAtMatrix(cam.pos, cam.target, [0, 1, 0]);
        const viewProj = multiplyMat4(proj, view);

        // PASS 2: Hardware-Instanced 3D Voxel Mini-Blocks
        gl.enable(gl.DEPTH_TEST);
        gl.depthMask(true);
        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);

        gl.useProgram(voxelProg);
        gl.bindVertexArray(voxelVAO);
        gl.uniformMatrix4fv(voxUniforms.viewProj, false, viewProj);
        gl.uniform1f(voxUniforms.blockScale, state.blockScale);
        gl.uniform1f(voxUniforms.time, timeSec);
        gl.uniform1i(voxUniforms.activeZone, state.activeZone);
        gl.uniform3fv(voxUniforms.hoverVoxel, state.hoverVoxel);
        gl.uniform3fv(voxUniforms.camPos, cam.pos);
        gl.uniform1f(voxUniforms.bevel, state.bevelStrength);
        gl.uniform1f(voxUniforms.magma, state.magmaIntensity);
        gl.uniform1i(voxUniforms.theme, state.theme);

        gl.drawElementsInstanced(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0, activeInstanceCount);

        // PASS 3: Additive Volumetric Magma Glow Halos
        if (state.theme !== 3) {
          gl.disable(gl.CULL_FACE);
          gl.depthMask(false);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE);

          gl.useProgram(glowProg);
          gl.bindVertexArray(glowVAO);
          gl.uniformMatrix4fv(glowUniforms.viewProj, false, viewProj);
          gl.uniform3fv(glowUniforms.camRight, cam.right);
          gl.uniform3fv(glowUniforms.camUp, cam.up);
          gl.uniform1f(glowUniforms.magma, state.magmaIntensity);
          gl.uniform1i(glowUniforms.activeZone, state.activeZone);

          gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, glowSprites.length);

          gl.disable(gl.BLEND);
          gl.depthMask(true);
        }

        requestAnimationFrame(renderFrame);
      }

      requestAnimationFrame(renderFrame);
    });
  })();
