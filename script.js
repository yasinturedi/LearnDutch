(function () {
    'use strict';

    var defaultText = "Na mijn ontdekking van de kist in de gracht, besloot ik de kaart verder te volgen.";

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

        if (!el_display || !el_container) return;

        var tapCount = 0;
        var tapTimer = null;
        var activeSpan = null;

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
                        messages: [{ role: 'system', content: "You are a professional Dutch-Turkish translator. Follow instructions exactly. Output ONLY what is requested, nothing else." }, { role: 'user', content: promptText }],
                        temperature: 0.1,
                        max_tokens: 60
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
                        "In this Dutch text: \"" + paragraph + "\"\n\nWhat does the word \"" + word + "\" mean in Turkish? Give ONLY 1-2 Turkish words as the answer.",
                        target
                    );
                } else {
                    // Double tap: Let AI find and translate the specific sentence
                    fetchTranslation(
                        "Sentence",
                        "Text: \"" + paragraph + "\"\n\nFind the ONE sentence that contains the word \"" + word + "\" and translate ONLY that sentence to Turkish. Output only the Turkish translation, nothing else.",
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
