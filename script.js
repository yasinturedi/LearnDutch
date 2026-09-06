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
            // Force canvas to extend beyond the viewport top to cover the notch/status bar area
            // We use a negative top and add that height to the total to maintain full coverage
            const overscan = 100;
            this.canvas.style.top = `-${overscan}px`;
            this.canvas.style.height = `calc(100dvh + ${overscan}px)`;
            this.canvas.style.width = '100vw'; // Ensure full width

            // Get the new extended size
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
                    // Initial distribution: Anywhere on screen or slightly above
                    this.y[i] = Math.random() * (this.canvas.height / this.dpr) - 50;
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
                    // Respawn above the screen to create 'bleed' from behind the notch
                    this.y[i] = -50 - Math.random() * 50;
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
        var el_formatText = document.getElementById('format-text-button');
        var el_formatStatus = document.getElementById('format-text-status');
        var el_save = document.getElementById('settings-save');
        var el_snowToggle = document.getElementById('snow-toggle');
        var el_languageOptions = document.querySelectorAll('input[name="translation-language"]');

        if (!el_display || !el_container) return;

        var tapCount = 0;
        var tapTimer = null;
        var lastTapTarget = null;
        var activeSpan = null;
        var translationRequestId = 0;
        var translationController = null;
        var snowOverlay = new SnowOverlay('snowCanvas');

        function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
        function set(k, v) { try { localStorage.setItem(k, v); } catch (e) { } }

        function render(text) {
            var raw = text || get('custom_dutch_text') || el_display.innerText || defaultText;
            el_display.innerHTML = '';

            // A blank line means a new paragraph. Single line breaks from copied
            // PDFs/websites are treated as wrapping inside the same paragraph.
            var paragraphs = raw.split(/\n\s*\n/);

            for (var p = 0; p < paragraphs.length; p++) {
                var para = paragraphs[p].replace(/\s+/g, ' ').trim();
                if (!para) continue;

                var paraDiv = document.createElement('div');
                paraDiv.className = "mb-8 leading-relaxed";

                var words = para.split(/\s+/);
                for (var w = 0; w < words.length; w++) {
                    var word = words[w];
                    if (!word) continue;

                    var span = document.createElement('span');
                    span.className = "word-span";
                    span.textContent = word;
                    span.setAttribute('data-paragraph', para);
                    span.setAttribute('data-word-index', String(w));
                    paraDiv.appendChild(span);
                    paraDiv.appendChild(document.createTextNode(' '));
                }

                el_display.appendChild(paraDiv);
            }
        }

        function getTargetLanguage() {
            return get('translation_language') === 'en'
                ? { code: 'en', name: 'English', shortName: 'EN' }
                : { code: 'tr', name: 'Turkish', shortName: 'TR' };
        }

        function buildMarkedContext(paragraph, wordIndex) {
            return paragraph.split(/\s+/).map(function (token, index) {
                return index === wordIndex ? '<<<' + token + '>>>' : token;
            }).join(' ');
        }

        function buildPrompt(mode, paragraph, word, wordIndex, languageName) {
            var markedContext = buildMarkedContext(paragraph, wordIndex);
            var shared = [
                'The source is Dutch. Translate into ' + languageName + '.',
                'The clicked token is marked with <<< >>>. These markers are not part of the source.',
                '',
                'SOURCE:',
                markedContext,
                '',
                'CLICKED WORD:',
                word
            ];

            if (mode === 'word') {
                return shared.concat([
                    '',
                    'TASK:',
                    'Give the primary meaning of the clicked word as it is used in this specific context.',
                    '',
                    'OUTPUT RULES:',
                    '- Return only the best contextual translation: one word or one short expression.',
                    '- Do not list alternatives, explain, define, quote the Dutch, or add a label.',
                    '- Translate the meaning in this context, not the word\'s most common dictionary meaning.'
                ]).join('\n');
            }

            return shared.concat([
                '',
                'TASK:',
                'Find the one semantic sentence that contains the marked word and translate that sentence.',
                'Infer the intended sentence boundaries from grammar and meaning even if punctuation is missing or incorrect.',
                '',
                'OUTPUT RULES:',
                '- Return only the translation of that one sentence.',
                '- Never translate the complete paragraph, a neighboring sentence, or unrelated context.',
                '- Do not quote the Dutch, explain your choice, or add a label.',
                '- Preserve the sentence\'s meaning and tone in natural ' + languageName + '.'
            ]).join('\n');
        }

        function getApiErrorMessage(status) {
            if (status === 401 || status === 403) return 'API key rejected';
            if (status === 404) return 'Selected model unavailable';
            if (status === 429) return 'API limit reached. Try again shortly.';
            if (status >= 500) return 'Groq is temporarily unavailable';
            return 'Request failed (' + status + ')';
        }

        function setFormatStatus(message, isError) {
            el_formatStatus.textContent = message || '';
            el_formatStatus.classList.toggle('hidden', !message);
            el_formatStatus.classList.toggle('text-red-400', Boolean(isError));
            el_formatStatus.classList.toggle('text-emerald-400', Boolean(message) && !isError);
        }

        function sameWordsAndPunctuation(first, second) {
            return first.replace(/\s+/g, ' ').trim() === second.replace(/\s+/g, ' ').trim();
        }

        async function organizeParagraphs() {
            var key = get('groq_api_key') || el_apiKey.value.trim();
            var sourceText = el_customText.value.trim();

            if (!key) {
                setFormatStatus('Add your Groq API key first.', true);
                return;
            }
            if (!sourceText) {
                setFormatStatus('Paste a Dutch text first.', true);
                return;
            }

            el_formatText.disabled = true;
            el_formatText.textContent = 'Organizing…';
            setFormatStatus('', false);

            try {
                var model = el_model.value || get('groq_model') || 'openai/gpt-oss-20b';
                var response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
                    body: JSON.stringify({
                        model: model,
                        messages: [
                            {
                                role: 'system',
                                content: 'You organize Dutch prose into readable paragraphs. You may change whitespace only. Never add, remove, reorder, correct, translate, or replace any word, letter, number, or punctuation mark.'
                            },
                            {
                                role: 'user',
                                content: [
                                    'Organize the Dutch text below into natural, readable paragraphs based on topic, scene, and flow.',
                                    'Aim for roughly 2–4 sentences per paragraph, but use shorter paragraphs for dialogue or a clear scene change.',
                                    'If punctuation is missing, infer paragraph boundaries from grammar and meaning without repairing the punctuation.',
                                    'Separate paragraphs with exactly one blank line.',
                                    'Return only the original text with improved whitespace. Every non-whitespace character must remain identical and in the same order.',
                                    '',
                                    'DUTCH TEXT:',
                                    sourceText
                                ].join('\n')
                            }
                        ],
                        temperature: 0,
                        max_completion_tokens: 4096,
                        reasoning_effort: model.indexOf('qwen/') === 0 ? 'none' : 'low',
                        reasoning_format: 'hidden'
                    })
                });
                var data = await response.json();

                if (!response.ok) {
                    console.error('Groq formatting error:', data && data.error ? data.error.message : response.status);
                    setFormatStatus(getApiErrorMessage(response.status), true);
                    return;
                }

                var formattedText = data && data.choices && data.choices[0] && data.choices[0].message
                    ? data.choices[0].message.content
                    : '';
                formattedText = typeof formattedText === 'string' ? formattedText.trim() : '';
                formattedText = formattedText.replace(/^```(?:text)?\s*/i, '').replace(/```$/i, '').trim();

                if (!formattedText) {
                    setFormatStatus('The model returned no formatted text.', true);
                    return;
                }
                if (!sameWordsAndPunctuation(sourceText, formattedText)) {
                    console.error('Formatting rejected because the source wording changed.');
                    setFormatStatus('Nothing changed: the AI result was incomplete or altered the wording. Please try again.', true);
                    return;
                }

                el_customText.value = formattedText;
                setFormatStatus('Paragraphs organized. Review them, then save.', false);
            } catch (error) {
                console.error('Paragraph formatting failed:', error);
                setFormatStatus('Could not organize the text. Check your connection.', true);
            } finally {
                el_formatText.disabled = false;
                el_formatText.textContent = 'Organize paragraphs with AI';
            }
        }

        async function fetchTranslation(titleText, promptText, anchor, language) {
            var requestId = ++translationRequestId;
            if (translationController) translationController.abort();
            translationController = null;

            var key = get('groq_api_key');
            if (!key) {
                showTooltip("NO API KEY", "Set in settings", false, anchor);
                return;
            }

            showTooltip(titleText, "", true, anchor);
            translationController = typeof AbortController !== 'undefined' ? new AbortController() : null;

            try {
                var model = get('groq_model') || 'openai/gpt-oss-20b';
                var requestBody = {
                    model: model,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a precise Dutch-to-' + language.name + ' translator for a language learner. Follow the requested scope exactly. Return only the translation, with no analysis, notes, labels, quotation marks, or source text.'
                        },
                        { role: 'user', content: promptText }
                    ],
                    temperature: 0.1,
                    max_completion_tokens: 400,
                    reasoning_effort: model.indexOf('qwen/') === 0 ? 'none' : 'low',
                    reasoning_format: 'hidden'
                };
                var r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
                    body: JSON.stringify(requestBody),
                    signal: translationController ? translationController.signal : undefined
                });
                var d = await r.json();
                if (!r.ok) {
                    console.error('Groq API error:', d && d.error ? d.error.message : r.status);
                    if (requestId === translationRequestId) {
                        showTooltip('API ERROR', getApiErrorMessage(r.status), false, anchor);
                    }
                    return;
                }

                var result = d && d.choices && d.choices[0] && d.choices[0].message
                    ? d.choices[0].message.content
                    : '';
                result = typeof result === 'string' ? result.trim() : '';

                if (!result) {
                    console.error('Groq API returned no translation:', d);
                    if (requestId === translationRequestId) {
                        showTooltip('NO RESULT', 'The model returned no translation', false, anchor);
                    }
                    return;
                }

                // Clean up any extra formatting
                result = result.replace(/^["']|["']$/g, '');
                result = result.replace(/^\*\*|\*\*$/g, '');
                result = result.replace(/^Translation:\s*/i, '');
                result = result.replace(/^Turkish:\s*/i, '');
                result = result.replace(/^English:\s*/i, '');

                if (requestId === translationRequestId) {
                    showTooltip(titleText, result, false, anchor);
                }
            } catch (e) {
                if (e && e.name === 'AbortError') return;
                console.error('Translation request failed:', e);
                if (requestId === translationRequestId) {
                    showTooltip("ERROR", "Check your connection", false, anchor);
                }
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
            translationRequestId++;
            if (translationController) translationController.abort();
            translationController = null;
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

            if (lastTapTarget !== target) tapCount = 0;
            lastTapTarget = target;
            tapCount++;
            clearTimeout(tapTimer);

            tapTimer = setTimeout(function () {
                var count = tapCount;
                tapCount = 0;

                var word = target.textContent.replace(/[.,!?";:()]/g, '');
                var paragraph = target.getAttribute('data-paragraph');
                var wordIndex = Number(target.getAttribute('data-word-index'));
                var language = getTargetLanguage();

                if (count === 1) {
                    fetchTranslation(
                        word + ' · ' + language.shortName,
                        buildPrompt('word', paragraph, word, wordIndex, language.name),
                        target,
                        language
                    );
                } else {
                    fetchTranslation(
                        'Sentence · ' + language.shortName,
                        buildPrompt('sentence', paragraph, word, wordIndex, language.name),
                        target,
                        language
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
        var savedLanguage = getTargetLanguage().code;
        for (var languageIndex = 0; languageIndex < el_languageOptions.length; languageIndex++) {
            el_languageOptions[languageIndex].checked = el_languageOptions[languageIndex].value === savedLanguage;
        }

        // Snow effect initialization
        var isSnowOn = get('let_it_snow') === 'true';
        el_snowToggle.checked = isSnowOn;
        if (isSnowOn) snowOverlay.start();

        // Browsers emit one click for one mouse click or touch tap. Listening only
        // here prevents the same phone tap being counted again as a synthetic click.
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

        el_formatText.addEventListener('click', organizeParagraphs);

        el_save.addEventListener('click', function () {
            set('groq_api_key', el_apiKey.value.trim());
            set('groq_model', el_model.value);
            set('custom_dutch_text', el_customText.value.trim());
            var selectedLanguage = document.querySelector('input[name="translation-language"]:checked');
            set('translation_language', selectedLanguage ? selectedLanguage.value : 'tr');

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
