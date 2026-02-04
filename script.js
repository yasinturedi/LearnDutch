(function () {
    'use strict';

    var defaultText = "Na mijn ontdekking van de kist in de gracht, besloot ik de kaart verder te volgen.";

    class SnowOverlay {
        constructor(canvasId) {
            this.canvas = document.getElementById(canvasId);
            if (!this.canvas) return;
            this.ctx = this.canvas.getContext('2d', {
                alpha: true,
                desynchronized: true,
                willReadFrequently: false
            });

            this.isActive = false;
            this.dpr = Math.min(window.devicePixelRatio || 1, 2);
            this.sprites = [];
            this.animationFrame = null;

            // Particle data buffers
            this.count = 0;
            this.x = null;
            this.y = null;
            this.speedY = null;
            this.baseSize = null;
            this.time = null;
            this.wobbleSpeed = null;
            this.wobbleAmount = null;
            this.wobbleSpeed2 = null;
            this.wobbleAmount2 = null;
            this.wobbleOffset = null;
            this.wobbleOffset2 = null;
            this.layerIdx = null;

            this.init();
        }

        init() {
            this.resizeCanvas();
            this.createSprites();
            this.initSnowflakes();

            let resizeTimeout;
            window.addEventListener('resize', () => {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    this.resizeCanvas();
                    this.initSnowflakes();
                }, 150);
            });
        }

        createSprites() {
            const opacityLayers = [0.15, 0.25, 0.35, 0.45, 0.55, 0.7, 0.85];
            this.sprites = opacityLayers.map(opacity => {
                const size = 10;
                const offCanvas = document.createElement('canvas');
                offCanvas.width = size * 2;
                offCanvas.height = size * 2;
                const offCtx = offCanvas.getContext('2d', { alpha: true });

                const grad = offCtx.createRadialGradient(size, size, 0, size, size, size);
                grad.addColorStop(0, `rgba(255, 255, 255, ${opacity})`);
                grad.addColorStop(0.5, `rgba(255, 255, 255, ${opacity * 0.5})`);
                grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

                offCtx.fillStyle = grad;
                offCtx.beginPath();
                offCtx.arc(size, size, size, 0, Math.PI * 2);
                offCtx.fill();

                return offCanvas;
            });
        }

        resizeCanvas() {
            // Use getBoundingClientRect to match the CSS 100dvh dimension exactly
            const rect = this.canvas.getBoundingClientRect();
            this.canvas.width = rect.width * this.dpr;
            this.canvas.height = rect.height * this.dpr;
            this.ctx.setTransform(1, 0, 0, 1, 0, 0);
            this.ctx.scale(this.dpr, this.dpr);
        }

        initSnowflakes() {
            const baseCount = 5000;
            const screenArea = window.innerWidth * window.innerHeight;
            const referenceArea = 1920 * 1080;
            const scaleFactor = Math.min(screenArea / referenceArea, 1.5);
            this.count = Math.floor(baseCount * scaleFactor);

            this.x = new Float32Array(this.count);
            this.y = new Float32Array(this.count);
            this.speedY = new Float32Array(this.count);
            this.baseSize = new Float32Array(this.count);
            this.time = new Float32Array(this.count);
            this.wobbleSpeed = new Float32Array(this.count);
            this.wobbleAmount = new Float32Array(this.count);
            this.wobbleSpeed2 = new Float32Array(this.count);
            this.wobbleAmount2 = new Float32Array(this.count);
            this.wobbleOffset = new Float32Array(this.count);
            this.wobbleOffset2 = new Float32Array(this.count);
            this.layerIdx = new Int8Array(this.count);

            const sizeLayers = [[0.2, 0.1], [0.3, 0.15], [0.4, 0.2], [0.6, 0.25], [0.85, 0.35], [1.2, 0.45], [1.5, 0.6]];
            const speedLayers = [[0.5, 4.0], [0.4, 3.5], [0.4, 3.0], [0.6, 2.5], [0.8, 2.0], [0.7, 1.5], [0.5, 1.2]];
            const layerDistribution = [0.35, 0.25, 0.15, 0.1, 0.08, 0.04, 0.03];

            let currentIdx = 0;
            for (let layer = 0; layer < 7; layer++) {
                const layerCount = Math.floor(this.count * layerDistribution[layer]);
                const endIdx = (layer === 6) ? this.count : currentIdx + layerCount;

                for (let i = currentIdx; i < endIdx; i++) {
                    this.x[i] = Math.random() * (this.canvas.width / this.dpr);
                    this.y[i] = Math.random() * (this.canvas.height / this.dpr);
                    this.layerIdx[i] = layer;
                    this.baseSize[i] = sizeLayers[layer][0] + Math.random() * sizeLayers[layer][1];
                    this.speedY[i] = speedLayers[layer][0] + Math.random() * speedLayers[layer][1];
                    this.wobbleOffset[i] = Math.random() * Math.PI * 2;
                    this.wobbleOffset2[i] = Math.random() * Math.PI * 2;
                    this.time[i] = Math.random() * 1000;

                    if (layer <= 2) {
                        this.wobbleSpeed[i] = 0.02 + Math.random() * 0.05;
                        this.wobbleAmount[i] = 20 + Math.random() * 40;
                        this.wobbleSpeed2[i] = 0.01 + Math.random() * 0.03;
                        this.wobbleAmount2[i] = 10 + Math.random() * 25;
                    } else if (layer <= 4) {
                        this.wobbleSpeed[i] = 0.015 + Math.random() * 0.025;
                        this.wobbleAmount[i] = 10 + Math.random() * 20;
                        this.wobbleSpeed2[i] = 0.008 + Math.random() * 0.015;
                        this.wobbleAmount2[i] = 5 + Math.random() * 12;
                    } else {
                        this.wobbleSpeed[i] = 0.005 + Math.random() * 0.01;
                        this.wobbleAmount[i] = 1 + Math.random() * 5;
                        this.wobbleSpeed2[i] = 0.002 + Math.random() * 0.005;
                        this.wobbleAmount2[i] = 0.5 + Math.random() * 3;
                    }
                }
                currentIdx = endIdx;
            }
        }

        animate() {
            if (!this.isActive) return;

            const ctx = this.ctx;
            const width = this.canvas.width / this.dpr;
            const height = this.canvas.height / this.dpr;
            ctx.clearRect(0, 0, width, height);

            for (let i = 0; i < this.count; i++) {
                this.y[i] += this.speedY[i];
                this.time[i] += this.wobbleSpeed[i];

                if (this.y[i] > height) {
                    this.y[i] = -10;
                    this.x[i] = Math.random() * width;
                }

                const wobbleX1 = Math.sin(this.time[i] + this.wobbleOffset[i]) * this.wobbleAmount[i];
                const wobbleX2 = Math.cos(this.time[i] * 0.8 + this.wobbleOffset2[i]) * this.wobbleAmount2[i];
                const currentX = this.x[i] + wobbleX1 + wobbleX2;
                const size = this.baseSize[i];

                ctx.drawImage(this.sprites[this.layerIdx[i]], currentX - size, this.y[i] - size, size * 2, size * 2);
            }

            this.animationFrame = requestAnimationFrame(() => this.animate());
        }

        start() {
            if (!this.isActive) {
                this.isActive = true;
                this.canvas.classList.add('active');
                this.animate();
            }
        }

        stop() {
            if (this.isActive) {
                this.isActive = false;
                this.canvas.classList.remove('active');
                if (this.animationFrame) {
                    cancelAnimationFrame(this.animationFrame);
                    this.animationFrame = null;
                }
                // Clear the canvas when stopping
                const width = this.canvas.width / this.dpr;
                const height = this.canvas.height / this.dpr;
                this.ctx.clearRect(0, 0, width, height);
            }
        }
    }

    function init() {
        var el_display = document.getElementById('dutch-text');
        var el_container = document.getElementById('practice-text-container');
        var el_tooltip = document.getElementById('tooltip-popup');
        var el_title = document.getElementById('tooltip-title');
        var el_body = document.getElementById('tooltip-body');
        var el_loading = document.getElementById('tooltip-loading');
        var el_trigger = document.getElementById('settings-trigger');
        var el_modal = document.getElementById('settings-modal');
        var el_apiKey = document.getElementById('api-key-input');
        var el_model = document.getElementById('model-select');
        var el_customText = document.getElementById('custom-text-input');
        var el_save = document.getElementById('settings-save');
        var el_snowToggle = document.getElementById('snow-toggle');

        if (!el_display || !el_container) return;

        var tapCount = 0;
        var tapTimer = null;
        var activeSpan = null;
        var snowOverlay = new SnowOverlay('snowCanvas');

        function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
        function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

        function render(text) {
            var raw = text || get('custom_dutch_text') || el_display.innerText || defaultText;
            el_display.innerHTML = '';

            var paragraphs = raw.split('\n');

            for (var p = 0; p < paragraphs.length; p++) {
                var para = paragraphs[p].trim();
                if (!para) {
                    el_display.appendChild(document.createElement('br'));
                    continue;
                }

                var paraDiv = document.createElement('div');
                paraDiv.className = "mb-8 leading-relaxed";

                var words = para.split(/\s+/);
                for (var w = 0; w < words.length; w++) {
                    var word = words[w];
                    if (!word) continue;

                    var span = document.createElement('span');
                    span.className = "word-span";
                    span.textContent = word;
                    // Store the full paragraph context
                    span.setAttribute('data-paragraph', para);
                    paraDiv.appendChild(span);
                    paraDiv.appendChild(document.createTextNode(' '));
                }

                el_display.appendChild(paraDiv);
            }
        }

        async function fetchTranslation(titleText, promptText, anchor) {
            var key = get('groq_api_key');
            if (!key) {
                showTooltip("NO API KEY", "Set in settings", false, anchor);
                return;
            }

            showTooltip(titleText, "", true, anchor);

            try {
                var model = get('groq_model') || 'llama-3.3-70b-versatile';
                var r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
                    body: JSON.stringify({
                        model: model,
                        messages: [{ role: 'system', content: "You are an expert Dutch-Turkish translator with a professional, academic focus. Your goal is to provide highly natural, idiomatic Turkish translations that capture the nuance of the Dutch source. CRITICAL: Never output the Dutch source text. Output ONLY the Turkish translation." }, { role: 'user', content: promptText }],
                        temperature: 0.1,
                        max_tokens: 100
                    })
                });
                var d = await r.json();
                var result = d.choices[0].message.content.trim();

                // Clean up any extra formatting
                result = result.replace(/^["']|["']$/g, '');
                result = result.replace(/^\*\*|\*\*$/g, '');
                result = result.replace(/^Translation:\s*/i, '');
                result = result.replace(/^Turkish:\s*/i, '');

                showTooltip(titleText, result, false, anchor);
            } catch (e) {
                showTooltip("ERROR", "Check connection", false, anchor);
            }
        }

        function showTooltip(title, content, isLoading, anchor) {
            el_title.textContent = title;
            if (isLoading) {
                el_loading.classList.remove('hidden');
                el_body.textContent = '';
            } else {
                el_loading.classList.add('hidden');
                el_body.textContent = content;
            }

            var rect = anchor.getBoundingClientRect();
            var cRect = el_container.getBoundingClientRect();

            var x = rect.left - cRect.left + (rect.width / 2);
            var y = rect.top - cRect.top - 10;

            el_tooltip.style.left = x + 'px';
            el_tooltip.style.top = y + 'px';
            el_tooltip.classList.remove('hidden');

            setTimeout(function () {
                var viewportWidth = window.innerWidth;
                var tRect = el_tooltip.getBoundingClientRect();
                var shift = 0;
                if (tRect.left < 15) shift = 15 - tRect.left;
                if (tRect.right > viewportWidth - 15) shift = (viewportWidth - 15) - tRect.right;
                if (shift !== 0) el_tooltip.style.left = (x + shift) + 'px';
                el_tooltip.classList.remove('opacity-0');
            }, 10);
        }

        function hideTooltip() {
            el_tooltip.classList.add('opacity-0');
            setTimeout(function () {
                el_tooltip.classList.add('hidden');
                if (activeSpan) {
                    activeSpan.classList.remove('active');
                    activeSpan = null;
                }
            }, 200);
        }

        function handleInteraction(e) {
            var target = e.target;
            if (!target.classList.contains('word-span')) return;

            e.preventDefault();
            e.stopPropagation();

            // Visual feedback
            if (activeSpan) activeSpan.classList.remove('active');
            target.classList.add('active');
            activeSpan = target;

            tapCount++;
            clearTimeout(tapTimer);

            tapTimer = setTimeout(function () {
                var count = tapCount;
                tapCount = 0;

                var word = target.textContent.replace(/[.,!?";:()]/g, '');
                var paragraph = target.getAttribute('data-paragraph');

                if (count === 1) {
                    // Single tap: contextual word meaning
                    fetchTranslation(
                        word,
                        "Context: \"" + paragraph + "\"\n\nTask: Translate the word \"" + word + "\" into Turkish, considering its context in the sentence. Provide ONLY the 1-2 most accurate Turkish words.",
                        target
                    );
                } else {
                    // Double tap: Let AI find and translate the specific sentence
                    fetchTranslation(
                        "Sentence",
                        "Context: \"" + paragraph + "\"\n\nTask: Identify the sentence containing \"" + word + "\". Translate it into professional, academic Turkish. Use natural, idiomatic phrasing.\n\nStrict Output Rules:\n1. Output ONLY the Turkish translation.\n2. Do NOT repeat the Dutch sentence.",
                        target
                    );
                }
            }, 300);
        }

        // Init
        render();

        el_apiKey.value = get('groq_api_key') || '';
        var m = get('groq_model');
        if (m) el_model.value = m;
        el_customText.value = get('custom_dutch_text') || el_display.innerText || defaultText;

        // Snow effect initialization
        var isSnowOn = get('let_it_snow') === 'true';
        el_snowToggle.checked = isSnowOn;
        if (isSnowOn) snowOverlay.start();

        // Universal event handler - works for both mobile and desktop
        el_display.addEventListener('touchend', handleInteraction, { passive: false });
        el_display.addEventListener('click', handleInteraction);

        // Dismiss tooltip
        document.addEventListener('touchstart', function (e) {
            if (!el_tooltip.contains(e.target) && !e.target.classList.contains('word-span')) {
                hideTooltip();
            }
        }, { passive: true });

        document.addEventListener('click', function (e) {
            if (!el_tooltip.contains(e.target) && !e.target.classList.contains('word-span')) {
                hideTooltip();
            }
        });

        // Settings
        el_trigger.addEventListener('click', function (e) {
            e.stopPropagation();
            el_modal.classList.remove('hidden');
            setTimeout(function () { el_modal.classList.remove('opacity-0'); }, 10);
        });

        el_save.addEventListener('click', function () {
            set('groq_api_key', el_apiKey.value.trim());
            set('groq_model', el_model.value);
            set('custom_dutch_text', el_customText.value.trim());

            var snowValue = el_snowToggle.checked;
            set('let_it_snow', snowValue);
            if (snowValue) snowOverlay.start();
            else snowOverlay.stop();

            render(el_customText.value.trim());
            el_modal.classList.add('opacity-0');
            setTimeout(function () { el_modal.classList.add('hidden'); }, 300);
        });

        el_modal.addEventListener('click', function (e) {
            if (e.target === el_modal) {
                el_modal.classList.add('opacity-0');
                setTimeout(function () { el_modal.classList.add('hidden'); }, 300);
            }
        });
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(init, 0);
    } else {
        window.addEventListener('DOMContentLoaded', init);
    }
})();
