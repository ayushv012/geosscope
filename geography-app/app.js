/* ============================================
   GeoScope — Application Logic
   Features: globe, hover, click-to-pin, search,
   fly-to, random, HUD, visit counter, keyboard
   ============================================ */

(function () {
    'use strict';

    /* ── Constants ──────────────────────────────── */
    var WORLD_POP = 8045311447; // ~8 billion

    var GEO_URLS = [
        'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@v5.1.1/geojson/ne_110m_admin_0_countries.geojson',
        'https://d2ad6b4ur7yvpq.cloudfront.net/naturalearth-3.3.0/ne_110m_admin_0_countries.geojson',
    ];

    /* ── DOM References ────────────────────────── */
    var $ = function (id) { return document.getElementById(id); };

    var globeContainer  = $('globeContainer');
    var infoDefault     = $('infoDefault');
    var infoContent     = $('infoContent');
    var globeLoading    = $('globeLoading');
    var themeToggle     = $('themeToggle');
    var toggleIcon      = $('toggleIcon');
    var searchInput     = $('searchInput');
    var searchResults   = $('searchResults');
    var searchKbd       = $('searchKbd');
    var randomBtn       = $('randomBtn');
    var pinBtn          = $('pinBtn');
    var pinIcon         = $('pinIcon');
    var flagImg         = $('flagImg');
    var flagPlaceholder = $('flagPlaceholder');
    var conflictToggle  = $('conflictToggle');
    var conflictIcon    = $('conflictIcon');
    var conflictLegend  = $('conflictLegend');
    var conflictInfoEl  = $('conflictInfo');
    var conflictBadge   = $('conflictBadge');
    var conflictTypeEl  = $('conflictType');
    var conflictDescEl  = $('conflictDesc');
    var conflictPartiesEl = $('conflictParties');
    var conflictSinceEl = $('conflictSince');

    /* Quiz DOM */
    var quizBtnEl     = $('quizBtn');
    var quizOverlay   = $('quizOverlay');
    var quizStartEl   = $('quizStart');
    var quizPlayEl    = $('quizPlay');
    var quizEndEl     = $('quizEnd');
    var quizGoBtn     = $('quizGo');
    var quizRetryBtn  = $('quizRetry');
    var quizCloseBtn  = $('quizClose');
    var quizBestEl    = $('quizBest');
    var qNumEl        = $('qNum');
    var qPtsEl        = $('qPts');
    var qTimerEl      = $('qTimer');
    var qStreakEl     = $('qStreak');
    var qStreakNEl    = $('qStreakN');
    var qPromptEl     = $('qPrompt');
    var qOptsEl       = $('qOpts');
    var qFinalEl      = $('qFinal');
    var qsCorrectEl   = $('qsCorrect');
    var qsAccEl       = $('qsAcc');
    var qsStreakEl    = $('qsStreak');

    /* Achievement DOM */
    var achieveBtn      = $('achieveBtn');
    var badgeDot        = $('badgeDot');
    var achieveBackdrop = $('achieveBackdrop');
    var achGrid         = $('achGrid');
    var achProgress     = $('achProgress');
    var achCloseBtn     = $('achClose');
    var toastContainer  = $('toastContainer');

    /* Compare DOM */
    var compareBtnEl    = $('compareBtn');
    var compareBackdrop = $('compareBackdrop');
    var cmpCloseBtn     = $('cmpClose');
    var cmpSearchEl     = $('cmpSearch');
    var cmpResultsEl    = $('cmpResults');
    var cmpBody         = $('cmpBody');
    var cmpFlagA        = $('cmpFlagA');
    var cmpFlagB        = $('cmpFlagB');
    var cmpNameA        = $('cmpNameA');
    var cmpNameB        = $('cmpNameB');
    var cmpBars         = $('cmpBars');

    var countryNameEl    = $('countryName');
    var countryContEl    = $('countryCont');
    var countryCapitalEl = $('countryCapital');
    var countryPopEl     = $('countryPop');
    var countryAreaEl    = $('countryArea');
    var countryLangEl    = $('countryLang');
    var countryCurrEl    = $('countryCurr');
    var countryGDPEl     = $('countryGDP');
    var countryFactEl    = $('countryFact');

    var hudLat      = $('hudLat');
    var hudLng      = $('hudLng');
    var hudAlt      = $('hudAlt');
    var popPct      = $('popPct');
    var popBarFill  = $('popBarFill');
    var visitCount  = $('visitCount');
    var visitTotal  = $('visitTotal');

    /* ── State ─────────────────────────────────── */
    var currentTheme   = 'dark';
    var hoveredCountry = null;
    var pinnedCountry  = null;  // locked country (click)
    var globe          = null;
    var allFeatures    = [];
    var visitedSet     = new Set();
    var searchActiveIdx = -1;
    var conflictMode   = false;

    /* Quiz state */
    var quizActive     = false;
    var quizMode       = 'identify';
    var quizQuestions   = [];
    var quizIdx        = 0;
    var quizScore      = 0;
    var quizCorrect    = 0;
    var quizStreak     = 0;
    var quizBestStreak = 0;
    var quizTimerId    = null;
    var quizTimeLeft   = 15;
    var quizAnswered   = false;
    var QUIZ_TOTAL     = 10;
    var QUIZ_TIME      = 15;

    /* Achievement state */
    var earnedAch      = JSON.parse(localStorage.getItem('geoscope_ach') || '{}');
    var quizzesPlayed  = parseInt(localStorage.getItem('geoscope_qplayed') || '0', 10);
    var bestQuizScore  = parseInt(localStorage.getItem('geoscope_qbest') || '0', 10);

    /* Compare state */
    var compareCountryA = null; // { name, facts, props }

    /* ── Theme Palettes ────────────────────────── */
    var themes = {
        dark: {
            atmosphere:  '#4a90d9',
            atmoAlt:     0.22,
            globeColor:  '#080818',
            cap:         'rgba(35, 48, 82, 0.85)',
            capAlt:      'rgba(42, 55, 85, 0.78)',
            hover:       'rgba(110, 198, 255, 0.7)',
            pinned:      'rgba(110, 198, 255, 0.55)',
            side:        'rgba(25, 35, 65, 0.35)',
            stroke:      'rgba(90, 130, 200, 0.18)',
            labelTxt:    '#dcdce6',
            labelBg:     'rgba(10,10,18,0.88)',
            labelBorder: 'rgba(255,255,255,0.08)',
            conflictHigh:   'rgba(255, 60, 60, 0.75)',
            conflictMedium: 'rgba(255, 140, 40, 0.68)',
            conflictLow:    'rgba(255, 200, 50, 0.6)',
            conflictDim:    'rgba(30, 30, 50, 0.55)',
        },
        beige: {
            atmosphere:  '#d4a574',
            atmoAlt:     0.18,
            globeColor:  '#a8c4d8',
            cap:         'rgba(185, 168, 132, 0.8)',
            capAlt:      'rgba(178, 160, 125, 0.75)',
            hover:       'rgba(181, 114, 42, 0.7)',
            pinned:      'rgba(181, 114, 42, 0.5)',
            side:        'rgba(160, 145, 110, 0.3)',
            stroke:      'rgba(150, 135, 100, 0.25)',
            labelTxt:    '#2a2218',
            labelBg:     'rgba(236,229,214,0.92)',
            labelBorder: 'rgba(0,0,0,0.08)',
            conflictHigh:   'rgba(200, 35, 35, 0.72)',
            conflictMedium: 'rgba(200, 110, 20, 0.65)',
            conflictLow:    'rgba(190, 155, 30, 0.58)',
            conflictDim:    'rgba(160, 148, 120, 0.45)',
        },
    };

    /* ── Helpers ────────────────────────────────── */

    function solidTexture(color) {
        var c = document.createElement('canvas');
        c.width = 4; c.height = 2;
        var ctx = c.getContext('2d');
        ctx.fillStyle = color;
        ctx.fillRect(0, 0, 4, 2);
        return c.toDataURL();
    }

    function getName(props) {
        return props.ADMIN || props.NAME || props.name || 'Unknown';
    }

    function resolveName(name) {
        if (countryFacts[name]) return name;
        if (typeof countryAliases !== 'undefined' && countryAliases[name]) {
            return countryAliases[name];
        }
        return name;
    }

    function nameHash(name) {
        var h = 0;
        for (var i = 0; i < name.length; i++) h += name.charCodeAt(i);
        return h;
    }

    /** Parse a population string like "331,449,281" into a number. */
    function parsePop(str) {
        if (!str) return 0;
        if (typeof str === 'number') return str;
        return parseInt(String(str).replace(/[^0-9]/g, ''), 10) || 0;
    }

    /**
     * Get the 2-letter ISO code from GeoJSON properties.
     * Natural Earth uses -99 for countries with disputed/missing ISO codes,
     * but often has the usable code in ISO_A2_EH. We iterate all candidate
     * fields and pick the first valid 2-letter code.
     */
    var ISO_OVERRIDES = {
        'Kosovo': 'xk',
        'Somaliland': 'so',
        'N. Cyprus': 'cy',
        'Northern Cyprus': 'cy',
    };

    function getISO2(props) {
        /* Try manual overrides first (for entities with no ISO code at all) */
        var name = props.ADMIN || props.NAME || props.name || '';
        if (ISO_OVERRIDES[name]) return ISO_OVERRIDES[name];

        /* Check every candidate field; pick the first valid 2-letter code */
        var fields = [
            props.ISO_A2, props.iso_a2,
            props.ISO_A2_EH, props.iso_a2_eh,
            props.WB_A2, props.wb_a2
        ];
        for (var i = 0; i < fields.length; i++) {
            var c = fields[i];
            if (c && c !== '-99' && c !== '-1' && c !== '-' && c.length === 2) {
                return c.toLowerCase();
            }
        }
        return '';
    }

    /** Load flag image from flagcdn.com via ISO-A2 code. */
    function showFlag(props) {
        var iso = getISO2(props);
        flagImg.classList.remove('loaded');

        if (!iso) {
            flagImg.src = '';
            return;
        }

        var url = 'https://flagcdn.com/w640/' + iso + '.png';
        flagImg.onload = function () { flagImg.classList.add('loaded'); };
        flagImg.onerror = function () { flagImg.classList.remove('loaded'); };
        flagImg.src = url;
        flagImg.alt = (props.ADMIN || props.NAME || '') + ' flag';
    }

    /** Get centroid of a GeoJSON feature (approximate). */
    function getCentroid(feature) {
        var coords = [];
        function collect(c, depth) {
            if (depth === 0) { coords.push(c); return; }
            for (var i = 0; i < c.length; i++) collect(c[i], depth - 1);
        }
        var geom = feature.geometry;
        if (geom.type === 'Polygon') collect(geom.coordinates, 2);
        else if (geom.type === 'MultiPolygon') collect(geom.coordinates, 3);

        if (coords.length === 0) return { lat: 0, lng: 0 };
        var sumLat = 0, sumLng = 0;
        for (var i = 0; i < coords.length; i++) {
            sumLng += coords[i][0];
            sumLat += coords[i][1];
        }
        return { lat: sumLat / coords.length, lng: sumLng / coords.length };
    }

    /* ── Conflict Lookup ───────────────────────── */

    function getConflict(d) {
        var nm = getName(d.properties || {});
        var resolved = resolveName(nm);
        return countryConflicts[nm] || countryConflicts[resolved] || null;
    }

    /* ── Polygon Color Logic ───────────────────── */

    function capColor(d) {
        var t = themes[currentTheme];
        if (d === pinnedCountry)  return t.pinned;
        if (d === hoveredCountry) return t.hover;

        if (conflictMode) {
            var conflict = getConflict(d);
            if (conflict) {
                return t['conflict' + conflict.severity.charAt(0).toUpperCase() + conflict.severity.slice(1)];
            }
            return t.conflictDim;
        }

        var nm = getName(d.properties || {});
        return nameHash(nm) % 2 === 0 ? t.cap : t.capAlt;
    }

    function polyAlt(d) {
        if (d === pinnedCountry)  return 0.045;
        if (d === hoveredCountry) return 0.03;

        if (conflictMode) {
            var conflict = getConflict(d);
            if (conflict) {
                if (conflict.severity === 'high')   return 0.025;
                if (conflict.severity === 'medium') return 0.018;
                return 0.012;
            }
        }

        return 0.006;
    }

    /* ── Globe Init ────────────────────────────── */

    function initGlobe() {
        var t = themes[currentTheme];

        globe = Globe()
            .width(globeContainer.clientWidth)
            .height(globeContainer.clientHeight)
            .backgroundColor('rgba(0,0,0,0)')
            .showAtmosphere(true)
            .atmosphereColor(t.atmosphere)
            .atmosphereAltitude(t.atmoAlt)
            .globeImageUrl(solidTexture(t.globeColor))
            .showGlobe(true)
            .polygonAltitude(polyAlt)
            .polygonCapColor(capColor)
            .polygonSideColor(function () { return themes[currentTheme].side; })
            .polygonStrokeColor(function () { return themes[currentTheme].stroke; })
            .polygonLabel(function (obj) {
                if (quizActive) return '';
                var t = themes[currentTheme];
                var name = getName(obj.properties || {});
                return '<div style="' +
                    'font-family:SF Mono,JetBrains Mono,monospace;' +
                    'padding:5px 10px;font-size:11px;letter-spacing:0.03em;' +
                    'color:' + t.labelTxt + ';' +
                    'background:' + t.labelBg + ';' +
                    'border:1px solid ' + t.labelBorder + ';' +
                    'border-radius:7px;backdrop-filter:blur(8px);' +
                    '">' + name + '</div>';
            })
            .onPolygonHover(handleHover)
            .onPolygonClick(handleClick)
            .polygonsTransitionDuration(220)
            (globeContainer);

        globe.pointOfView({ lat: 25, lng: 10, altitude: 2.2 });

        var ctrl = globe.controls();
        ctrl.autoRotate      = true;
        ctrl.autoRotateSpeed = 0.35;
        ctrl.enableDamping   = true;
        ctrl.dampingFactor   = 0.12;
        ctrl.rotateSpeed     = 0.8;
        ctrl.zoomSpeed       = 0.6;
        ctrl.minDistance      = 115;
        ctrl.maxDistance      = 600;

        var idleTimer;
        ctrl.addEventListener('start', function () {
            ctrl.autoRotate = false;
            clearTimeout(idleTimer);
        });
        ctrl.addEventListener('end', function () {
            clearTimeout(idleTimer);
            idleTimer = setTimeout(function () { ctrl.autoRotate = true; }, 8000);
        });

        window.addEventListener('resize', function () {
            globe.width(globeContainer.clientWidth);
            globe.height(globeContainer.clientHeight);
        });

        /* HUD update loop */
        setInterval(updateHUD, 300);

        loadCountryData();
    }

    /* ── Data Loading ──────────────────────────── */

    async function loadCountryData() {
        var data = null;
        for (var i = 0; i < GEO_URLS.length; i++) {
            try {
                var res = await fetch(GEO_URLS[i]);
                if (res.ok) { data = await res.json(); break; }
            } catch (_) { /* next */ }
        }

        if (!data || !data.features) {
            globeLoading.querySelector('p').textContent =
                'Failed to load map data. Please refresh.';
            return;
        }

        allFeatures = data.features.filter(function (f) {
            var iso = (f.properties.ISO_A2 || f.properties.iso_a2 || '');
            return iso !== 'AQ';
        });

        globe.polygonsData(allFeatures);

        visitTotal.textContent = allFeatures.length;

        globeLoading.style.opacity = '0';
        setTimeout(function () { globeLoading.style.display = 'none'; }, 400);
    }

    /* ── HUD ───────────────────────────────────── */

    function updateHUD() {
        if (!globe) return;
        var pov = globe.pointOfView();
        hudLat.textContent = pov.lat.toFixed(2);
        hudLng.textContent = pov.lng.toFixed(2);
        hudAlt.textContent = pov.altitude.toFixed(2);
    }

    /* ── Hover ─────────────────────────────────── */

    function handleHover(polygon) {
        if (quizActive) return;
        hoveredCountry = polygon;
        refreshGlobe();

        if (pinnedCountry) return; // don't update panel when pinned

        if (polygon) {
            var props = polygon.properties || {};
            showCountryInfo(getName(props), props);
            trackVisit(getName(props));
        } else {
            hideCountryInfo();
        }
    }

    /* ── Click (pin / fly-to) ──────────────────── */

    function handleClick(polygon) {
        if (quizActive) return;
        if (!polygon) return;

        /* Toggle pin */
        if (pinnedCountry === polygon) {
            pinnedCountry = null;
            pinBtn.classList.remove('pinned');
            pinIcon.textContent = '\u2739'; // ✹
            hideCountryInfo();
        } else {
            pinnedCountry = polygon;
            pinBtn.classList.add('pinned');
            pinIcon.textContent = '\u25C9'; // ◉

            var props = polygon.properties || {};
            showCountryInfo(getName(props), props);
            trackVisit(getName(props));
            flyToFeature(polygon);
        }

        refreshGlobe();
    }

    function flyToFeature(feature) {
        var c = getCentroid(feature);
        globe.pointOfView({ lat: c.lat, lng: c.lng, altitude: 1.6 }, 1200);
        globe.controls().autoRotate = false;
    }

    /* ── Refresh Globe Visuals ─────────────────── */

    function refreshGlobe() {
        globe.polygonAltitude(polyAlt).polygonCapColor(capColor);
    }

    /* ── Visit Tracking ────────────────────────── */

    function trackVisit(name) {
        if (!visitedSet.has(name)) {
            visitedSet.add(name);
            visitCount.textContent = visitedSet.size;
        }
    }

    /* ── Info Panel ─────────────────────────────── */

    function showCountryInfo(rawName, geoProps) {
        var resolved = resolveName(rawName);
        var facts = countryFacts[resolved];

        infoDefault.style.display = 'none';
        infoContent.style.display = 'block';
        infoContent.style.animation = 'none';
        void infoContent.offsetHeight;
        infoContent.style.animation = '';

        countryNameEl.textContent = rawName;

        /* Flag */
        showFlag(geoProps);

        var pop = 0;

        if (facts) {
            countryContEl.textContent    = facts.continent;
            countryCapitalEl.textContent = facts.capital;
            countryPopEl.textContent     = facts.population;
            countryAreaEl.textContent    = facts.area;
            countryLangEl.textContent    = facts.languages;
            countryCurrEl.textContent    = facts.currency;
            countryGDPEl.textContent     = facts.gdp;
            countryFactEl.textContent    = facts.funFact;
            pop = parsePop(facts.population);
        } else {
            var rawPop = geoProps.POP_EST || geoProps.pop_est;
            var popStr = rawPop ? Number(rawPop).toLocaleString() : '\u2014';
            var continent = geoProps.CONTINENT || geoProps.REGION_UN || geoProps.continent || '\u2014';
            var gdp = geoProps.GDP_MD_EST || geoProps.GDP_MD;

            countryContEl.textContent    = continent;
            countryCapitalEl.textContent = '\u2014';
            countryPopEl.textContent     = popStr;
            countryAreaEl.textContent    = '\u2014';
            countryLangEl.textContent    = '\u2014';
            countryCurrEl.textContent    = '\u2014';
            countryGDPEl.textContent     = gdp ? '$' + Number(gdp).toLocaleString() + 'M' : '\u2014';
            countryFactEl.textContent    = 'Detailed facts for this country are coming soon.';
            pop = parsePop(rawPop);
        }

        /* Population bar */
        var pct = pop > 0 ? Math.max(0.3, (pop / WORLD_POP) * 100) : 0;
        popPct.textContent = pop > 0 ? (pop / WORLD_POP * 100).toFixed(2) + '% of world' : '\u2014';
        popBarFill.style.width = pct + '%';

        /* Compare button visibility */
        compareBtnEl.style.display = pinnedCountry ? '' : 'none';
        compareCountryA = { name: rawName, resolved: resolved, facts: facts, props: geoProps };

        /* Conflict info */
        var conflict = countryConflicts[resolved] || countryConflicts[rawName];
        if (conflict) {
            conflictInfoEl.style.display = 'block';
            conflictInfoEl.className = 'conflict-info severity-' + conflict.severity;
            conflictBadge.textContent = conflict.type;
            conflictTypeEl.textContent = conflict.severity.toUpperCase() + ' SEVERITY';
            conflictDescEl.textContent = conflict.description;
            conflictPartiesEl.textContent = conflict.parties.join(' \u2022 ');
            conflictSinceEl.textContent = conflict.startYear;
        } else {
            conflictInfoEl.style.display = 'none';
        }
    }

    function hideCountryInfo() {
        infoDefault.style.display = 'flex';
        infoContent.style.display = 'none';
        conflictInfoEl.style.display = 'none';
    }

    /* ── Search ────────────────────────────────── */

    function performSearch(query) {
        var q = query.trim().toLowerCase();
        searchActiveIdx = -1;

        if (q.length === 0) {
            searchResults.classList.remove('open');
            searchResults.innerHTML = '';
            return;
        }

        /* Search through loaded features */
        var matches = [];
        for (var i = 0; i < allFeatures.length && matches.length < 12; i++) {
            var n = getName(allFeatures[i].properties || {});
            if (n.toLowerCase().indexOf(q) !== -1) {
                matches.push({ name: n, feature: allFeatures[i] });
            }
        }

        /* Also search country facts for unlisted aliases */
        var factKeys = Object.keys(countryFacts);
        for (var j = 0; j < factKeys.length && matches.length < 12; j++) {
            var k = factKeys[j];
            if (k.toLowerCase().indexOf(q) !== -1) {
                var already = matches.some(function (m) { return m.name === k; });
                if (!already) {
                    var feat = findFeatureByName(k);
                    if (feat) matches.push({ name: k, feature: feat });
                }
            }
        }

        if (matches.length === 0) {
            searchResults.innerHTML = '<div class="search-no-results">No countries found</div>';
            searchResults.classList.add('open');
            return;
        }

        var html = '';
        for (var m = 0; m < matches.length; m++) {
            var cont = '';
            var resolved = resolveName(matches[m].name);
            if (countryFacts[resolved]) cont = countryFacts[resolved].continent;
            else {
                var p = matches[m].feature.properties || {};
                cont = p.CONTINENT || p.REGION_UN || '';
            }
            html += '<div class="search-result-item" data-idx="' + m + '">' +
                '<span class="sr-name">' + matches[m].name + '</span>' +
                '<span class="sr-cont">' + cont + '</span>' +
                '</div>';
        }

        searchResults.innerHTML = html;
        searchResults.classList.add('open');

        /* Attach click handlers */
        var items = searchResults.querySelectorAll('.search-result-item');
        items.forEach(function (el, idx) {
            el.addEventListener('click', function () {
                selectSearchResult(matches[idx]);
            });
        });
    }

    function selectSearchResult(match) {
        pinnedCountry = match.feature;
        pinBtn.classList.add('pinned');
        pinIcon.textContent = '\u25C9';
        showCountryInfo(match.name, match.feature.properties || {});
        trackVisit(match.name);
        flyToFeature(match.feature);
        refreshGlobe();
        closeSearch();
    }

    function closeSearch() {
        searchResults.classList.remove('open');
        searchResults.innerHTML = '';
        searchInput.value = '';
        searchInput.blur();
        searchKbd.style.display = '';
        searchActiveIdx = -1;
    }

    function findFeatureByName(name) {
        for (var i = 0; i < allFeatures.length; i++) {
            var n = getName(allFeatures[i].properties || {});
            if (n === name || resolveName(n) === name) return allFeatures[i];
        }
        return null;
    }

    /* Search event listeners */
    searchInput.addEventListener('input', function () {
        searchKbd.style.display = searchInput.value.length > 0 ? 'none' : '';
        performSearch(searchInput.value);
    });

    searchInput.addEventListener('focus', function () {
        searchKbd.style.display = 'none';
        if (searchInput.value.length > 0) performSearch(searchInput.value);
    });

    searchInput.addEventListener('keydown', function (e) {
        var items = searchResults.querySelectorAll('.search-result-item');
        if (items.length === 0) {
            if (e.key === 'Escape') { closeSearch(); e.preventDefault(); }
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            searchActiveIdx = Math.min(searchActiveIdx + 1, items.length - 1);
            updateActiveSearchItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            searchActiveIdx = Math.max(searchActiveIdx - 1, 0);
            updateActiveSearchItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (searchActiveIdx >= 0 && searchActiveIdx < items.length) {
                items[searchActiveIdx].click();
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            closeSearch();
        }
    });

    function updateActiveSearchItem(items) {
        items.forEach(function (el, i) {
            el.classList.toggle('active', i === searchActiveIdx);
        });
        if (searchActiveIdx >= 0 && items[searchActiveIdx]) {
            items[searchActiveIdx].scrollIntoView({ block: 'nearest' });
        }
    }

    /* Close search on outside click */
    document.addEventListener('click', function (e) {
        if (!e.target.closest('.search-wrapper')) {
            searchResults.classList.remove('open');
        }
    });

    /* ── Random Country ────────────────────────── */

    function goRandom() {
        if (allFeatures.length === 0) return;
        var idx = Math.floor(Math.random() * allFeatures.length);
        var f = allFeatures[idx];
        pinnedCountry = f;
        pinBtn.classList.add('pinned');
        pinIcon.textContent = '\u25C9';
        var name = getName(f.properties || {});
        showCountryInfo(name, f.properties || {});
        trackVisit(name);
        flyToFeature(f);
        refreshGlobe();
    }

    randomBtn.addEventListener('click', goRandom);

    /* ── Pin Button ────────────────────────────── */

    pinBtn.addEventListener('click', function () {
        if (pinnedCountry) {
            pinnedCountry = null;
            pinBtn.classList.remove('pinned');
            pinIcon.textContent = '\u2739';
            hideCountryInfo();
            refreshGlobe();
        }
    });

    /* ── Conflict Mode Toggle ─────────────────── */

    function toggleConflict() {
        conflictMode = !conflictMode;
        conflictToggle.classList.toggle('conflict-active', conflictMode);
        conflictLegend.style.display = conflictMode ? 'flex' : 'none';
        refreshGlobe();
    }

    conflictToggle.addEventListener('click', toggleConflict);

    /* ── Theme Toggle ──────────────────────────── */

    function toggleTheme() {
        currentTheme = currentTheme === 'dark' ? 'beige' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        toggleIcon.textContent = currentTheme === 'dark' ? '\u263D' : '\u2600';

        if (!globe) return;
        var t = themes[currentTheme];
        globe
            .globeImageUrl(solidTexture(t.globeColor))
            .atmosphereColor(t.atmosphere)
            .atmosphereAltitude(t.atmoAlt)
            .polygonCapColor(capColor)
            .polygonSideColor(function () { return t.side; })
            .polygonStrokeColor(function () { return t.stroke; });
    }

    themeToggle.addEventListener('click', toggleTheme);

    /* ============================================
       QUIZ SYSTEM
       ============================================ */

    function getFactPool() {
        var keys = Object.keys(countryFacts);
        return keys.filter(function (k) {
            return findFeatureByName(k) !== null;
        });
    }

    function shuffle(arr) {
        for (var i = arr.length - 1; i > 0; i--) {
            var j = Math.floor(Math.random() * (i + 1));
            var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
        }
        return arr;
    }

    function generateQuestions(mode) {
        var pool = getFactPool();
        if (pool.length < 4) return [];
        shuffle(pool);
        var qs = [];
        var used = pool.slice(0, QUIZ_TOTAL);

        for (var i = 0; i < used.length; i++) {
            var correct = used[i];
            var facts = countryFacts[correct];
            var feature = findFeatureByName(correct);
            if (!feature) continue;

            /* Pick 3 wrong answers from same continent if possible */
            var sameCont = pool.filter(function (k) {
                return k !== correct && countryFacts[k].continent === facts.continent;
            });
            var diffCont = pool.filter(function (k) {
                return k !== correct && countryFacts[k].continent !== facts.continent;
            });
            shuffle(sameCont); shuffle(diffCont);
            var wrongs = sameCont.slice(0, 2).concat(diffCont.slice(0, 2)).slice(0, 3);
            if (wrongs.length < 3) {
                var extras = pool.filter(function (k) {
                    return k !== correct && wrongs.indexOf(k) === -1;
                });
                shuffle(extras);
                wrongs = wrongs.concat(extras).slice(0, 3);
            }

            var options, prompt;

            if (mode === 'capitals') {
                prompt = 'What is the capital of ' + correct + '?';
                options = shuffle([
                    { text: facts.capital, correct: true },
                    { text: countryFacts[wrongs[0]].capital, correct: false },
                    { text: countryFacts[wrongs[1]].capital, correct: false },
                    { text: countryFacts[wrongs[2]].capital, correct: false }
                ]);
            } else if (mode === 'continents') {
                prompt = 'Which continent is ' + correct + ' in?';
                var allConts = ['Africa', 'Asia', 'Europe', 'North America', 'South America', 'Oceania'];
                var rightCont = facts.continent;
                var wrongConts = shuffle(allConts.filter(function (c) { return c !== rightCont; })).slice(0, 3);
                options = shuffle([
                    { text: rightCont, correct: true },
                    { text: wrongConts[0], correct: false },
                    { text: wrongConts[1], correct: false },
                    { text: wrongConts[2], correct: false }
                ]);
            } else if (mode === 'population') {
                prompt = 'Which country has the largest population?';
                var allPops = [
                    { name: correct, pop: parsePop(facts.population) },
                    { name: wrongs[0], pop: parsePop(countryFacts[wrongs[0]].population) },
                    { name: wrongs[1], pop: parsePop(countryFacts[wrongs[1]].population) },
                    { name: wrongs[2], pop: parsePop(countryFacts[wrongs[2]].population) }
                ];
                allPops.sort(function (a, b) { return b.pop - a.pop; });
                var biggest = allPops[0].name;
                options = shuffle(allPops.map(function (p) {
                    return { text: p.name, correct: p.name === biggest };
                }));
            } else {
                prompt = 'Which country is this?';
                options = shuffle([
                    { text: correct, correct: true },
                    { text: wrongs[0], correct: false },
                    { text: wrongs[1], correct: false },
                    { text: wrongs[2], correct: false }
                ]);
            }

            qs.push({
                country: correct,
                feature: feature,
                prompt: prompt,
                options: options
            });
        }
        return qs;
    }

    function openQuiz() {
        quizOverlay.style.display = 'flex';
        quizStartEl.style.display = 'flex';
        quizPlayEl.style.display = 'none';
        quizEndEl.style.display = 'none';
        quizBestEl.textContent = bestQuizScore;
        quizBtnEl.classList.add('quiz-active');
    }

    function closeQuiz() {
        quizOverlay.style.display = 'none';
        quizActive = false;
        quizBtnEl.classList.remove('quiz-active');
        clearInterval(quizTimerId);
    }

    function startQuiz() {
        quizQuestions = generateQuestions(quizMode);
        if (quizQuestions.length === 0) return;
        quizIdx = 0; quizScore = 0; quizCorrect = 0;
        quizStreak = 0; quizBestStreak = 0;
        quizActive = true;

        quizStartEl.style.display = 'none';
        quizPlayEl.style.display = 'flex';
        quizEndEl.style.display = 'none';

        if (globe) globe.controls().autoRotate = false;
        showQuestion();
    }

    function showQuestion() {
        if (quizIdx >= quizQuestions.length) { endQuiz(); return; }
        var q = quizQuestions[quizIdx];
        quizAnswered = false;
        qNumEl.textContent = (quizIdx + 1) + '/' + QUIZ_TOTAL;
        qPtsEl.textContent = quizScore;
        qPromptEl.textContent = q.prompt;

        /* Fly globe to country */
        if (q.feature) {
            pinnedCountry = q.feature;
            flyToFeature(q.feature);
            refreshGlobe();
        }

        /* Render options */
        qOptsEl.innerHTML = '';
        q.options.forEach(function (opt) {
            var btn = document.createElement('button');
            btn.className = 'qopt-btn';
            btn.textContent = opt.text;
            btn.addEventListener('click', function () { answerQuestion(btn, opt); });
            qOptsEl.appendChild(btn);
        });

        /* Timer */
        quizTimeLeft = QUIZ_TIME;
        qTimerEl.textContent = quizTimeLeft;
        qTimerEl.classList.remove('timer-low');
        clearInterval(quizTimerId);
        quizTimerId = setInterval(function () {
            quizTimeLeft--;
            qTimerEl.textContent = quizTimeLeft;
            if (quizTimeLeft <= 5) qTimerEl.classList.add('timer-low');
            if (quizTimeLeft <= 0) { clearInterval(quizTimerId); timeOut(); }
        }, 1000);
    }

    function answerQuestion(btn, opt) {
        if (quizAnswered) return;
        quizAnswered = true;
        clearInterval(quizTimerId);

        var btns = qOptsEl.querySelectorAll('.qopt-btn');
        btns.forEach(function (b) {
            b.disabled = true;
            /* Reveal correct answer */
            var bText = b.textContent;
            var q = quizQuestions[quizIdx];
            var isCorrect = q.options.some(function (o) { return o.text === bText && o.correct; });
            if (isCorrect) b.classList.add('qopt-correct');
        });

        if (opt.correct) {
            btn.classList.add('qopt-correct');
            var timeBonus = Math.round((quizTimeLeft / QUIZ_TIME) * 50);
            quizScore += 100 + timeBonus;
            quizCorrect++;
            quizStreak++;
            if (quizStreak > quizBestStreak) quizBestStreak = quizStreak;
            qStreakEl.style.opacity = quizStreak >= 2 ? '1' : '0';
            qStreakNEl.textContent = quizStreak;
            /* Check streak achievements */
            if (quizStreak >= 5) checkAchievement('quiz_streak5');
            if (quizStreak >= 10) checkAchievement('quiz_streak10');
        } else {
            btn.classList.add('qopt-wrong');
            quizStreak = 0;
            qStreakEl.style.opacity = '0';
        }
        qPtsEl.textContent = quizScore;

        setTimeout(function () {
            quizIdx++;
            showQuestion();
        }, 1400);
    }

    function timeOut() {
        if (quizAnswered) return;
        quizAnswered = true;
        quizStreak = 0;
        qStreakEl.style.opacity = '0';
        var btns = qOptsEl.querySelectorAll('.qopt-btn');
        btns.forEach(function (b) {
            b.disabled = true;
            var bText = b.textContent;
            var q = quizQuestions[quizIdx];
            var isCorrect = q.options.some(function (o) { return o.text === bText && o.correct; });
            if (isCorrect) b.classList.add('qopt-correct');
        });
        setTimeout(function () { quizIdx++; showQuestion(); }, 1400);
    }

    function endQuiz() {
        quizActive = false;
        pinnedCountry = null;
        clearInterval(quizTimerId);

        quizPlayEl.style.display = 'none';
        quizEndEl.style.display = 'flex';

        qFinalEl.textContent = quizScore;
        qsCorrectEl.textContent = quizCorrect + '/' + QUIZ_TOTAL;
        qsAccEl.textContent = Math.round((quizCorrect / QUIZ_TOTAL) * 100) + '%';
        qsStreakEl.textContent = quizBestStreak;

        quizzesPlayed++;
        localStorage.setItem('geoscope_qplayed', quizzesPlayed);

        if (quizScore > bestQuizScore) {
            bestQuizScore = quizScore;
            localStorage.setItem('geoscope_qbest', bestQuizScore);
        }

        /* Achievements */
        checkAchievement('quiz_first');
        if (quizCorrect === QUIZ_TOTAL) checkAchievement('quiz_perfect');
        if (quizScore >= 500) checkAchievement('quiz_score500');

        refreshGlobe();
    }

    /* Quiz mode selection */
    var modeButtons = document.querySelectorAll('.qmode-btn');
    var quizProNotice = $('quizProNotice');
    var proNoticeTimer = null;

    modeButtons.forEach(function (btn) {
        btn.addEventListener('click', function () {
            if (btn.classList.contains('locked')) {
                /* Show "coming soon" notice */
                quizProNotice.style.display = 'block';
                clearTimeout(proNoticeTimer);
                proNoticeTimer = setTimeout(function () {
                    quizProNotice.style.display = 'none';
                }, 3000);
                return;
            }
            quizProNotice.style.display = 'none';
            modeButtons.forEach(function (b) { b.classList.remove('active'); });
            btn.classList.add('active');
            quizMode = btn.getAttribute('data-mode');
        });
    });

    quizBtnEl.addEventListener('click', openQuiz);
    quizGoBtn.addEventListener('click', startQuiz);
    quizRetryBtn.addEventListener('click', startQuiz);
    quizCloseBtn.addEventListener('click', closeQuiz);

    /* ============================================
       ACHIEVEMENT SYSTEM
       ============================================ */

    function checkAchievement(id) {
        if (earnedAch[id]) return;
        earnedAch[id] = Date.now();
        localStorage.setItem('geoscope_ach', JSON.stringify(earnedAch));
        var def = achievementDefs.find(function (a) { return a.id === id; });
        if (def) showToast(def.icon + '  ' + def.name, def.desc);
        badgeDot.style.display = '';
    }

    function checkExploreAchievements() {
        var count = visitedSet.size;
        if (count >= 1)   checkAchievement('first_visit');
        if (count >= 10)  checkAchievement('visit_10');
        if (count >= 25)  checkAchievement('visit_25');
        if (count >= 50)  checkAchievement('visit_50');
        if (count >= 100) checkAchievement('visit_100');

        /* Continent achievements */
        var contCounts = {};
        visitedSet.forEach(function (name) {
            var resolved = resolveName(name);
            var facts = countryFacts[resolved];
            if (facts) {
                var c = facts.continent;
                contCounts[c] = (contCounts[c] || 0) + 1;
            }
        });
        if ((contCounts['Africa'] || 0) >= 10) checkAchievement('cont_africa');
        if ((contCounts['Europe'] || 0) >= 10) checkAchievement('cont_europe');
        if ((contCounts['Asia'] || 0) >= 10)   checkAchievement('cont_asia');
        if (((contCounts['North America'] || 0) + (contCounts['South America'] || 0)) >= 10) checkAchievement('cont_americas');
        if ((contCounts['Oceania'] || 0) >= 5) checkAchievement('cont_oceania');
    }

    function renderAchievements() {
        achGrid.innerHTML = '';
        var total = achievementDefs.length;
        var earned = Object.keys(earnedAch).length;
        achProgress.textContent = earned + ' / ' + total;

        achievementDefs.forEach(function (def) {
            var unlocked = !!earnedAch[def.id];
            var isPro = def.category === 'pro';
            var card = document.createElement('div');
            card.className = 'ach-card' + (unlocked ? ' unlocked' : '') + (isPro ? ' pro-locked' : '');
            card.innerHTML =
                '<div class="ach-icon">' + (isPro && !unlocked ? '\u{1F512}' : def.icon) + '</div>' +
                '<div class="ach-info">' +
                    '<span class="ach-name">' + def.name + (isPro ? ' <span class="pro-tag">PRO</span>' : '') + '</span>' +
                    '<span class="ach-desc">' + def.desc + '</span>' +
                '</div>';
            achGrid.appendChild(card);
        });
    }

    function openAchievements() {
        renderAchievements();
        achieveBackdrop.style.display = 'flex';
    }

    function closeAchievements() {
        achieveBackdrop.style.display = 'none';
    }

    achieveBtn.addEventListener('click', openAchievements);
    achCloseBtn.addEventListener('click', closeAchievements);
    achieveBackdrop.addEventListener('click', function (e) {
        if (e.target === achieveBackdrop) closeAchievements();
    });

    /* ============================================
       TOAST NOTIFICATIONS
       ============================================ */

    function showToast(title, message) {
        var el = document.createElement('div');
        el.className = 'toast';
        el.innerHTML = '<strong class="toast-title">' + title + '</strong><span class="toast-msg">' + message + '</span>';
        toastContainer.appendChild(el);
        requestAnimationFrame(function () { el.classList.add('show'); });
        setTimeout(function () {
            el.classList.remove('show');
            setTimeout(function () { el.remove(); }, 400);
        }, 3500);
    }

    /* ============================================
       COUNTRY COMPARISON
       ============================================ */

    function parseNum(str) {
        if (!str) return 0;
        if (typeof str === 'number') return str;
        var s = String(str).replace(/[^0-9.]/g, '');
        var n = parseFloat(s) || 0;
        if (/trillion/i.test(str)) n *= 1e12;
        else if (/billion/i.test(str)) n *= 1e9;
        else if (/million/i.test(str)) n *= 1e6;
        return n;
    }

    function fmtNum(n) {
        if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
        if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
        if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
        if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return n.toLocaleString();
    }

    function openCompare() {
        if (!compareCountryA) return;
        compareBackdrop.style.display = 'flex';
        cmpBody.style.display = 'none';
        cmpSearchEl.value = '';
        cmpResultsEl.innerHTML = '';
        cmpSearchEl.focus();

        /* Set country A info */
        var a = compareCountryA;
        cmpNameA.textContent = a.name;
        var isoA = getISO2(a.props || {});
        cmpFlagA.src = isoA ? 'https://flagcdn.com/w160/' + isoA + '.png' : '';
    }

    function closeCompare() {
        compareBackdrop.style.display = 'none';
        cmpSearchEl.value = '';
        cmpResultsEl.innerHTML = '';
    }

    function compareWith(nameB) {
        var resolvedB = resolveName(nameB);
        var factsB = countryFacts[resolvedB];
        var featB = findFeatureByName(nameB) || findFeatureByName(resolvedB);
        if (!factsB) return;

        cmpResultsEl.innerHTML = '';
        cmpBody.style.display = 'block';

        var propsB = featB ? featB.properties || {} : {};
        cmpNameB.textContent = nameB;
        var isoB = getISO2(propsB);
        cmpFlagB.src = isoB ? 'https://flagcdn.com/w160/' + isoB + '.png' : '';

        var a = compareCountryA;
        var fa = a.facts || {};
        var fb = factsB;

        var metrics = [
            { label: 'Population', a: parsePop(fa.population), b: parsePop(fb.population), prefix: '' },
            { label: 'Area (km\u00B2)', a: parseNum(fa.area), b: parseNum(fb.area), prefix: '' },
            { label: 'GDP', a: parseNum(fa.gdp), b: parseNum(fb.gdp), prefix: '$' }
        ];

        cmpBars.innerHTML = '';
        metrics.forEach(function (m) {
            var max = Math.max(m.a, m.b) || 1;
            var pctA = (m.a / max) * 100;
            var pctB = (m.b / max) * 100;
            var row = document.createElement('div');
            row.className = 'cmp-row';
            row.innerHTML =
                '<div class="cmp-label">' + m.label + '</div>' +
                '<div class="cmp-bar-pair">' +
                    '<div class="cmp-bar-wrap left">' +
                        '<span class="cmp-val">' + m.prefix + fmtNum(m.a) + '</span>' +
                        '<div class="cmp-bar-track"><div class="cmp-bar-fill a" style="width:' + pctA + '%"></div></div>' +
                    '</div>' +
                    '<div class="cmp-bar-wrap right">' +
                        '<div class="cmp-bar-track"><div class="cmp-bar-fill b" style="width:' + pctB + '%"></div></div>' +
                        '<span class="cmp-val">' + m.prefix + fmtNum(m.b) + '</span>' +
                    '</div>' +
                '</div>';
            cmpBars.appendChild(row);
        });
    }

    /* Compare search */
    cmpSearchEl.addEventListener('input', function () {
        var q = cmpSearchEl.value.trim().toLowerCase();
        if (q.length === 0) { cmpResultsEl.innerHTML = ''; return; }
        var matches = [];
        var keys = Object.keys(countryFacts);
        for (var i = 0; i < keys.length && matches.length < 8; i++) {
            if (keys[i].toLowerCase().indexOf(q) !== -1 && keys[i] !== (compareCountryA && compareCountryA.resolved)) {
                matches.push(keys[i]);
            }
        }
        cmpResultsEl.innerHTML = '';
        matches.forEach(function (name) {
            var div = document.createElement('div');
            div.className = 'cmp-result-item';
            div.textContent = name;
            div.addEventListener('click', function () { compareWith(name); });
            cmpResultsEl.appendChild(div);
        });
    });

    compareBtnEl.addEventListener('click', openCompare);
    cmpCloseBtn.addEventListener('click', closeCompare);
    compareBackdrop.addEventListener('click', function (e) {
        if (e.target === compareBackdrop) closeCompare();
    });

    /* ── Keyboard Shortcuts ────────────────────── */

    document.addEventListener('keydown', function (e) {
        /* Don't fire shortcuts when typing in inputs */
        if (document.activeElement === searchInput || document.activeElement === cmpSearchEl) return;

        if (e.key === 'Escape') {
            if (quizOverlay.style.display !== 'none') { closeQuiz(); return; }
            if (achieveBackdrop.style.display !== 'none') { closeAchievements(); return; }
            if (compareBackdrop.style.display !== 'none') { closeCompare(); return; }
            if (pinnedCountry) {
                pinnedCountry = null;
                pinBtn.classList.remove('pinned');
                pinIcon.textContent = '\u2739';
                hideCountryInfo();
                refreshGlobe();
            }
            return;
        }

        if (e.key === '/') {
            e.preventDefault();
            searchInput.focus();
        } else if (e.key.toLowerCase() === 'q' && !e.metaKey && !e.ctrlKey) {
            openQuiz();
        } else if (e.key.toLowerCase() === 'a' && !e.metaKey && !e.ctrlKey) {
            openAchievements();
        } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
            goRandom();
        } else if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey) {
            toggleTheme();
        } else if (e.key.toLowerCase() === 'c' && !e.metaKey && !e.ctrlKey) {
            toggleConflict();
        }
    });

    /* ── Hook: visit tracking → achievements ───── */

    var _origTrackVisit = trackVisit;
    trackVisit = function (name) {
        _origTrackVisit(name);
        checkExploreAchievements();
    };

    /* ── Start ─────────────────────────────────── */
    initGlobe();

})();
