// 3D Ship Renderer using Three.js
// Renders ships as 3D models on a transparent WebGL overlay

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.162.0/build/three.module.js';

// Feature flag - set to false to disable 3D ships
export const ENABLE_3D_SHIPS = true;

class Ship3DRenderer {
    constructor() {
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.ships = new Map(); // empireId_fleetId -> mesh
        this.initialized = false;
        this.canvas2D = null;
    }

    init(canvas2D) {
        if (this.initialized || !ENABLE_3D_SHIPS) return;
        
        this.canvas2D = canvas2D;
        
        // Create WebGL renderer with transparent background
        this.renderer = new THREE.WebGLRenderer({ 
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.setClearColor(0x000000, 0); // Transparent
        
        // Position overlay canvas
        const glCanvas = this.renderer.domElement;
        glCanvas.id = 'ship3d-canvas';
        glCanvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            pointer-events: none;
            z-index: 10;
        `;
        
        // Insert after 2D canvas
        canvas2D.parentElement.style.position = 'relative';
        canvas2D.parentElement.appendChild(glCanvas);
        
        // Create scene
        this.scene = new THREE.Scene();
        
        // Orthographic camera (matches 2D canvas)
        this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 1000);
        this.camera.position.z = 100;
        
        // Ambient light
        const ambient = new THREE.AmbientLight(0xffffff, 0.6);
        this.scene.add(ambient);
        
        // Directional light for 3D depth
        const directional = new THREE.DirectionalLight(0xffffff, 0.8);
        directional.position.set(1, 1, 1);
        this.scene.add(directional);
        
        // Handle resize
        this.resize();
        window.addEventListener('resize', () => this.resize());
        
        this.initialized = true;
        console.log('[Ship3D] ✅ Three.js renderer initialized');
    }

    resize() {
        if (!this.canvas2D || !this.renderer) return;
        
        const width = this.canvas2D.clientWidth;
        const height = this.canvas2D.clientHeight;
        
        this.renderer.setSize(width, height);
        
        // Update orthographic camera to match canvas aspect
        const aspect = width / height;
        this.camera.left = -aspect * 100;
        this.camera.right = aspect * 100;
        this.camera.top = 100;
        this.camera.bottom = -100;
        this.camera.updateProjectionMatrix();
    }

    // Create a simple 3D spaceship mesh
    createShipMesh(color = 0x00d9ff) {
        const group = new THREE.Group();
        
        // Main body (elongated cone pointing right)
        const bodyGeometry = new THREE.ConeGeometry(0.8, 3, 6);
        bodyGeometry.rotateZ(-Math.PI / 2); // Point right
        const bodyMaterial = new THREE.MeshStandardMaterial({ 
            color: color,
            metalness: 0.7,
            roughness: 0.3,
            emissive: color,
            emissiveIntensity: 0.2
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(body);
        
        // Wings
        const wingGeometry = new THREE.BoxGeometry(1.5, 0.1, 2);
        const wingMaterial = new THREE.MeshStandardMaterial({ 
            color: 0x333333,
            metalness: 0.8,
            roughness: 0.2
        });
        const wings = new THREE.Mesh(wingGeometry, wingMaterial);
        wings.position.x = -0.5;
        group.add(wings);
        
        // Engine glow
        const engineGeometry = new THREE.SphereGeometry(0.3, 8, 8);
        const engineMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ffff,
            transparent: true,
            opacity: 0.8
        });
        const engine = new THREE.Mesh(engineGeometry, engineMaterial);
        engine.position.x = -1.5;
        group.add(engine);
        
        return group;
    }

    // Sync camera with 2D renderer camera
    syncCamera(camera2D) {
        if (!this.camera || !this.canvas2D) return;
        
        // Convert 2D camera to 3D orthographic
        const width = this.canvas2D.clientWidth;
        const height = this.canvas2D.clientHeight;
        const zoom = camera2D.zoom || 1;
        
        // Scale the view based on 2D zoom
        const viewWidth = width / zoom;
        const viewHeight = height / zoom;
        
        this.camera.left = -viewWidth / 2;
        this.camera.right = viewWidth / 2;
        this.camera.top = viewHeight / 2;
        this.camera.bottom = -viewHeight / 2;
        
        // Offset camera based on 2D camera position
        this.camera.position.x = camera2D.x || 0;
        this.camera.position.y = -(camera2D.y || 0); // Flip Y for 3D
        
        this.camera.updateProjectionMatrix();
    }

    // Update ship positions from game state
    // Now accepts full state to look up system coordinates (like 2D renderer)
    updateShips(state, empireColors, camera2D) {
        if (!this.initialized || !ENABLE_3D_SHIPS) return;
        
        const fleets = state?.fleetsInTransit || [];
        const systems = state?.universe?.solarSystems || [];
        const activeIds = new Set();
        
        fleets.forEach(fleet => {
            // Look up system coordinates (same as 2D fleet renderer)
            const originSystem = systems.find(s => s.id === fleet.originSystemId);
            const destSystem = systems.find(s => s.id === fleet.destSystemId);
            
            if (!originSystem || !destSystem) return;
            if (fleet.originSystemId === fleet.destSystemId) return; // Skip same-system
            
            const originX = originSystem.x;
            const originY = originSystem.y;
            const destX = destSystem.x;
            const destY = destSystem.y;
            
            const id = `${fleet.empireId}_${fleet.id || fleet.originSystemId}`;
            activeIds.add(id);
            
            // Get or create ship mesh
            let ship = this.ships.get(id);
            if (!ship) {
                const colorHex = empireColors[fleet.empireId] || '#00d9ff';
                const color = parseInt(colorHex.replace('#', ''), 16);
                ship = this.createShipMesh(color);
                this.scene.add(ship);
                this.ships.set(id, ship);
            }
            
            // Calculate position (interpolate based on progress)
            const progress = fleet.progress || 0;
            const x = originX + (destX - originX) * progress;
            const y = originY + (destY - originY) * progress;
            
            // Position in 3D space
            ship.position.x = x;
            ship.position.y = -y; // Flip Y
            ship.position.z = 0;
            
            // Rotate to face direction of travel
            const angle = Math.atan2(destY - originY, destX - originX);
            ship.rotation.z = -angle; // Flip for 3D coords
            
            // Scale based on ship count
            const scale = 1 + Math.min(fleet.shipCount || 1, 10) * 0.1;
            ship.scale.setScalar(scale * 3); // Base scale for visibility
        });
        
        // Remove ships that are no longer in transit
        for (const [id, ship] of this.ships) {
            if (!activeIds.has(id)) {
                this.scene.remove(ship);
                ship.geometry?.dispose();
                ship.material?.dispose();
                this.ships.delete(id);
            }
        }
    }

    render(state, empireColors, camera2D) {
        if (!this.initialized || !ENABLE_3D_SHIPS) return;
        
        this.syncCamera(camera2D);
        this.updateShips(state, empireColors, camera2D);
        this.renderer.render(this.scene, this.camera);
    }

    // Clean up
    dispose() {
        if (this.renderer) {
            this.renderer.dispose();
            this.renderer.domElement.remove();
        }
        this.ships.forEach(ship => {
            this.scene.remove(ship);
        });
        this.ships.clear();
        this.initialized = false;
    }
}

// Singleton instance
export const ship3D = new Ship3DRenderer();
