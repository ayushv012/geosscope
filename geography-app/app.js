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

    /* ── Polygon Color Logic ───────────────────── */

    function capColor(d) {
        var t = themes[currentTheme];
        if (d === pinnedCountry)  return t.pinned;
        if (d === hoveredCountry) return t.hover;
        var nm = getName(d.properties || {});
        return nameHash(nm) % 2 === 0 ? t.cap : t.capAlt;
    }

    function polyAlt(d) {
        if (d === pinnedCountry)  return 0.045;
        if (d === hoveredCountry) return 0.03;
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
    }

    function hideCountryInfo() {
        infoDefault.style.display = 'flex';
        infoContent.style.display = 'none';
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

    /* ── Keyboard Shortcuts ────────────────────── */

    document.addEventListener('keydown', function (e) {
        /* Don't fire shortcuts when typing in search */
        if (document.activeElement === searchInput) return;

        if (e.key === '/') {
            e.preventDefault();
            searchInput.focus();
        } else if (e.key === 'Escape') {
            if (pinnedCountry) {
                pinnedCountry = null;
                pinBtn.classList.remove('pinned');
                pinIcon.textContent = '\u2739';
                hideCountryInfo();
                refreshGlobe();
            }
        } else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) {
            goRandom();
        } else if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey) {
            toggleTheme();
        }
    });

    /* ── Start ─────────────────────────────────── */
    initGlobe();

})();
