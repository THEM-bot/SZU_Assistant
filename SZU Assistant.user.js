// ==UserScript==
// @name            SZU Assistant
// @namespace       http://tampermonkey.net/
// @version         1.3.0
// @description     SZU Assistant：深大内部网辅助脚本，101避难所出品。内部网首页左上角增加快捷入口，内联宿舍用电查询（支持全部校区），自动登录办事大厅/校园网络续费，公文通去水印，办事大厅修读课程统计下载，网上评教一键五星+评价。
// @author          白玉京
// @match           https://elearning.szu.edu.cn/*
// @match           https://authserver.szu.edu.cn/*
// @match           https://drcom.szu.edu.cn/*
// @match           https://self.szu.edu.cn/*
// @match           https://www1.szu.edu.cn/*
// @match           http://www1.szu.edu.cn/*
// @match           http://ehall.szu.edu.cn/*
// @match           https://ehall.szu.edu.cn/*
// @match           http://bkxk.szu.edu.cn/*
// @match           https://*.webvpn.szu.edu.cn/*
// @match           172.30.255.2/*
// @match           172.30.255.42/*
// @grant           GM_setValue
// @grant           GM_getValue
// @grant           GM_addStyle
// @grant           GM_xmlhttpRequest
// @require         https://cdn.bootcdn.net/ajax/libs/jquery/3.4.1/jquery.min.js
// @require         https://greasyfork.org.cn/scripts/422854-bubble-message.js
// @run-at          document-end
// @noframes
// ==/UserScript==

(function() {
    'use strict'
    const __VERSION__ = "1.3.0";

    // DEBUG
    try { document.title = '[SZU] ' + document.title; } catch(e) {}
    try { console.log('[SZU] Script v' + __VERSION__ + ' executing, host=' + location.host); } catch(e) {}

    // ====== Utility functions ======
    function makeElement(tagName, attributes, config, style, events) {
        if (!attributes) attributes = {};
        if (!config) config = {};
        if (!style) style = {};
        if (!events) events = {};
        if (typeof style === 'string')
            style = Object.fromEntries(style.trim().split(/\s*;\s*/).filter(function(p) { return p.includes(':'); }).map(function(p) { return p.split(/\s*:\s*/); }));
        var el = document.createElement(tagName);
        Object.entries(attributes).forEach(function(e) { el.setAttribute(e[0], String(e[1])); });
        Object.entries(config).forEach(function(e) { el[e[0]] = e[1]; });
        Object.entries(style).forEach(function(e) { el.style[e[0]] = e[1]; });
        Object.entries(events).forEach(function(e) { el.addEventListener(e[0], e[1]); });
        return el;
    }

    function execUntil(task, cond, timeout, thisArg) {
        timeout = timeout || 250;
        if (cond()) { task.apply(thisArg); }
        else { setTimeout(function() { execUntil(task, cond, timeout, thisArg); }, timeout); }
    }

    function monitor(node, options, callback) {
        if (Array.isArray(options)) options = Object.fromEntries(options.map(function(o) { return [o, true]; }));
        var observer = new MutationObserver(callback);
        observer.observe(node, options);
        return observer;
    }

    // ====== Account ======
    var account = GM_getValue('account');
    var hasUpdatedInfo = false;
    if (!account) { account = { cid: '', uid: '', pwd: '' }; GM_setValue('account', account); }
    else { hasUpdatedInfo = account.cid && account.uid && account.pwd; }

    // ====== Floating panel (vanilla JS, no jQuery dependency) ======
    if (location.host.match(/www1.*?\.szu\.edu\.cn/)) {
        (function injectFloatingPanel() {
            if (document.getElementById('convenient-szu-panel')) return;

            function showToast(msg, type) {
                var t = document.createElement('div');
                t.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
                    'padding:10px 24px;border-radius:6px;color:#fff;font-size:14px;box-shadow:0 2px 12px rgba(0,0,0,.25);' +
                    (type === 'success' ? 'background:#52c41a;' : 'background:#ff4d4f;');
                t.textContent = msg;
                document.body.appendChild(t);
                setTimeout(function() { t.remove(); }, 2500);
            }

            try {
                GM_addStyle(
                    '#convenient-szu-panel{position:fixed!important;top:10px!important;left:10px!important;' +
                    'z-index:2147483647!important;font-family:"Microsoft YaHei","PingFang SC",sans-serif!important;' +
                    'font-size:13px!important;color:#999!important;pointer-events:auto!important}' +
                    '#convenient-szu-toggle{width:36px!important;height:36px!important;border:none!important;' +
                    'border-radius:8px!important;background:#1a1a2e!important;color:#fff!important;cursor:pointer!important;' +
                    'font-size:18px!important;line-height:36px!important;text-align:center!important;' +
                    'box-shadow:0 2px 8px rgba(0,0,0,.5)!important;transition:transform .2s!important;' +
                    'outline:none!important;display:block!important;padding:0!important;margin:0!important}' +
                    '#convenient-szu-toggle:hover{transform:scale(1.08)!important;background:#e94560!important;color:#fff!important}' +
                    '#convenient-szu-body{display:none!important;position:absolute!important;top:44px!important;' +
                    'left:0!important;background:#2a2a3e!important;border-radius:10px!important;' +
                    'box-shadow:0 4px 20px rgba(0,0,0,.5)!important;padding:16px!important;min-width:260px!important;' +
                    'border:1px solid #444!important;pointer-events:auto!important}' +
                    '#convenient-szu-body.open{display:block!important}' +
                    '#convenient-szu-body a{display:block!important;padding:6px 0!important;color:#fff!important;' +
                    'text-decoration:none!important;border-bottom:1px dotted #555!important;white-space:nowrap!important;' +
                    'font-size:13px!important;cursor:pointer!important}' +
                    '#convenient-szu-body a:last-child{border-bottom:none!important}' +
                    '#convenient-szu-body a:hover{color:#e94560!important;background:#333!important;padding-left:4px!important}' +
                    '#convenient-szu-body .panel-divider{margin:8px 0!important;border-top:1px solid #555!important}' +
                    '#convenient-szu-body .panel-info-title{font-weight:bold!important;color:#fff!important;' +
                    'margin-bottom:6px!important;font-size:12px!important}' +
                    '#convenient-szu-body input{width:100%!important;box-sizing:border-box!important;margin-bottom:6px!important;' +
                    'padding:4px 6px!important;border:1px solid #555!important;border-radius:4px!important;font-size:12px!important;' +
                    'background:#333!important;color:#999!important}' +
                    '#convenient-szu-body select{width:100%!important;box-sizing:border-box!important;margin-bottom:6px!important;' +
                    'padding:4px 6px!important;border:1px solid #555!important;border-radius:4px!important;font-size:12px!important;' +
                    'background:#333!important;color:#999!important}' +
                    '#convenient-szu-body .panel-btn{width:100%!important;padding:5px!important;border:none!important;' +
                    'border-radius:4px!important;background:#e94560!important;color:#fff!important;cursor:pointer!important;' +
                    'font-size:12px!important}' +
                    '#convenient-szu-body .panel-btn:hover{background:#ff6b81!important}' +
                    '#convenient-szu-body table th{background:#1a1a2e!important;color:#fff!important}' +
                    '#convenient-szu-body table td{color:#999!important}' +
                    '#convenient-szu-watermark{position:fixed!important;bottom:8px!important;right:12px!important;' +
                    'z-index:2147483646!important;font-size:11px!important;color:rgba(233,69,96,.3)!important;' +
                    'font-family:"Microsoft YaHei",sans-serif!important;pointer-events:none!important}' +
                    'input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{-webkit-appearance:none!important;margin:0!important}'
                );

                var panel = makeElement('div', { id: 'convenient-szu-panel' });
                var toggle = makeElement('button', { id: 'convenient-szu-toggle', title: 'SZU Assistant' }, { innerHTML: '\u2630' });
                var body = makeElement('div', { id: 'convenient-szu-body' });

                // Quick links
                var links = [
                    ['\u7f51\u7edc\u7eed\u8d39', 'https://self.szu.edu.cn/self/'],
                    ['\u767b\u5f55 Dr.com', 'http://172.30.255.42/a79.htm'],
                    ['\u77e5\u7f51', 'http://www.lib.szu.edu.cn/er/cnki'],
                    ['\u8868\u683c\u4e0b\u8f7d', 'https://jwb.szu.edu.cn/xzzq1/jxyxs.htm'],
                    ['\u8f6f\u4ef6\u4e0b\u8f7d', 'https://www1.szu.edu.cn/nc/view.asp?id=64'],
                ];
                links.forEach(function(item) {
                    body.appendChild(makeElement('a', { href: item[1], target: '_blank' }, { innerHTML: item[0] }));
                });

                // Electricity query section (collapsible)
                body.appendChild(makeElement('div', { class: 'panel-divider' }));
                var elecHeader = makeElement('div', { class: 'panel-info-title' }, { innerHTML: '\u25b6 \u5bbf\u820d\u7528\u7535\u67e5\u8be2' }, {
                    'cursor': 'pointer', 'user-select': 'none'
                });
                var elecWrap = makeElement('div', {}, {}, { 'display': 'none' });
                elecHeader.onclick = function() {
                    var open = elecWrap.style.display !== 'none';
                    elecWrap.style.display = open ? 'none' : 'block';
                    elecHeader.innerHTML = (open ? '\u25b6' : '\u25bc') + ' \u5bbf\u820d\u7528\u7535\u67e5\u8be2';
                };
                body.appendChild(elecHeader);
                body.appendChild(elecWrap);
                var mainBody = body;
                body = elecWrap;

                var ELE_CAMPUSES = [
                    {name:'\u658b\u533a\uff08\u897f\u5357/\u4e54\u5bb6\u5927\u9662\u7b49\uff09', client:'192.168.84.1', type:'old', buildings:[
                        ['6363','\u4e54\u679711-12\u5c42'],['6364','\u4e54\u672811-12\u5c42'],['6875','\u4e54\u68ee\u96012-10\u5c42'],['6876','\u4e54\u68ee11-20\u5c42'],
                        ['6877','\u4e54\u76f8\u96012-10\u5c42'],['6878','\u4e54\u76f811-20\u5c42'],['6121','\u4e54\u6797\u96011-10\u5c42'],['6122','\u4e54\u6728\u96011-10\u5c42'],
                        ['7724','\u4e54\u68a7\u96012-10\u5c42'],['7725','\u4e54\u68a711-20\u5c42'],['8147','\u7559\u5b66\u751f\u516c\u5bd3'],
                        ['54','\u5c71\u8336\u658b'],['55','\u7ea2\u69b4\u658b'],['56','\u7c73\u5170\u658b'],['57','\u6d77\u6850\u658b'],['58','\u6843\u674e\u658b'],
                        ['59','\u51cc\u9704\u658b'],['61','\u94f6\u6866\u658b'],['63','\u6728\u7280\u8f69'],['64','\u4e39\u67ab\u8f69'],['65','\u7d2b\u6a80\u8f69'],
                        ['66','\u77f3\u6960\u8f69'],['67','\u82cf\u94c1\u8f69'],['68','\u82b8\u9999\u9601'],['69','\u4e01\u9999\u9601'],['70','\u6587\u674f\u9601'],
                        ['71','\u6d77\u68e0\u9601'],['72','\u758f\u5f71\u9601'],['73','\u675c\u8861\u9601'],['74','\u8f9b\u5937\u9601'],['75','\u97f5\u7af9\u9601'],
                        ['76','\u4e91\u6749\u8f69'],['77','\u7d2b\u85e4\u8f69']
                    ]},
                    {name:'\u5357\u533a\uff08\u6625\u7b1b/\u590f\u7b5d/\u79cb\u745f/\u51ac\u7b51\uff09', client:'192.168.84.110', type:'old', buildings:[
                        ['6875','\u6625\u7b1b3-8\u697c'],['7119','\u6625\u7b1b9-17\u697c'],['6876','\u590f\u7b5d3-17\u697c'],['6877','\u79cb\u745f3-8\u697c'],
                        ['7828','\u79cb\u745f9-17\u697c'],['6878','\u51ac\u7b513-6\u697c'],['8240','\u51ac\u7b517-10\u697c'],
                        ['8241','\u51ac\u7b5111-14\u697c'],['8242','\u51ac\u7b5115-17\u697c']
                    ]},
                    {name:'\u4e3d\u6e56\u6821\u533a\uff08\u98ce\u4fe1\u5b50/\u5c71\u6942\u6811/\u80e1\u6768\u6797\uff09', client:'172.21.101.11', type:'old', buildings:[
                        ['10057','A\u680b\u98ce\u4fe1\u5b50'],['10934','B\u680b\u5c71\u6942\u6811'],['10935','C\u680b\u80e1\u6768\u6797']
                    ]},
                    {name:'\u65b0\u658b\u533a\uff08\u98ce\u69d0/\u96e8\u5d43/\u805a\u7ff0/\u7ea2\u8c46/\u7d2b\u8587/\u84ec\u83b1\uff09', client:'192.168.84.87', type:'old', buildings:[
                        ['7126','\u98ce\u69d0\u658b'],['7603','\u96e8\u5d43\u658b'],['17887','\u84ec\u83b1\u5ba2\u820d'],
                        ['18118','\u805a\u7ff0\u658b'],['18119','\u7d2b\u8587\u658b'],['18120','\u7ea2\u8c46\u658b']
                    ]},
                    {name:'\u4e3d\u6e56\u4e8c\u671f\uff08\u68a7\u6850\u6811/\u9752\u5188\u6801/\u4e09\u89d2\u6885\u7b49\uff09', client:'', type:'lake2', buildings:[]}
                ];

                // Campus select
                var elecCampusSel = makeElement('select', {}, {}, { 'width':'100%','padding':'4px','margin-bottom':'6px','border-radius':'4px','border':'1px solid #555','font-size':'12px' });
                elecCampusSel.appendChild(makeElement('option', { value:'' }, { innerHTML: '\u9009\u62e9\u6821\u533a' }));
                ELE_CAMPUSES.forEach(function(c, i) { elecCampusSel.appendChild(makeElement('option', { value:String(i) }, { innerHTML: c.name })); });

                var elecBuildingSel = makeElement('select', {}, {}, { 'width':'100%','padding':'4px','margin-bottom':'6px','border-radius':'4px','border':'1px solid #555','font-size':'12px' });
                elecBuildingSel.appendChild(makeElement('option', { value:'' }, { innerHTML: '\u9009\u62e9\u697c\u680b' }));

                var elecRoomInp = makeElement('input', { type:'text', placeholder:'\u623f\u95f4\u53f7' }, {}, { 'width':'100%','padding':'4px','margin-bottom':'6px' });
                var elecStatus = makeElement('div', {}, {}, { 'font-size':'11px','color':'#999','margin-bottom':'4px','min-height':'16px' });
                var elecResTable = makeElement('div', {}, {}, { 'max-height':'200px','overflow-y':'auto','font-size':'11px','display':'none' });

                var elecBtnRow = makeElement('div', {}, {}, { 'display':'flex','gap':'4px','margin-bottom':'4px' });
                var elecFetchBtn = makeElement('button', {}, { innerHTML: '\u83b7\u53d6ID' }, { 'flex':'1','padding':'4px','border':'1px solid #fff','border-radius':'4px','background':'transparent','color':'#fff','cursor':'pointer','font-size':'11px' });
                var elecQueryBtn = makeElement('button', {}, { innerHTML: '\u67e5\u8be2\u7535\u91cf' }, { 'flex':'1','padding':'4px','border':'none','border-radius':'4px','background':'#e94560','color':'#fff','cursor':'pointer','font-size':'11px' });
                elecBtnRow.appendChild(elecFetchBtn);
                elecBtnRow.appendChild(elecQueryBtn);

                body.appendChild(elecCampusSel);
                body.appendChild(elecBuildingSel);
                body.appendChild(elecRoomInp);
                body.appendChild(elecStatus);
                body.appendChild(elecBtnRow);
                body.appendChild(elecResTable);

                // Restore saved values
                var savedCi = GM_getValue('elecCampusIdx');
                var savedBi = GM_getValue('elecBuildingIdx');
                var savedRn = GM_getValue('elecRoomName') || '';
                if (typeof savedCi === 'number' && savedCi < ELE_CAMPUSES.length) elecCampusSel.value = String(savedCi);
                elecRoomInp.value = savedRn;

                elecCampusSel.onchange = function() {
                    elecBuildingSel.innerHTML = '<option value="">\u9009\u62e9\u697c\u680b</option>';
                    var ci = parseInt(elecCampusSel.value);
                    if (ci >= 0 && ci < ELE_CAMPUSES.length) {
                        var camp = ELE_CAMPUSES[ci];
                        if (camp.type === 'lake2') {
                            elecBuildingSel.innerHTML = '<option value="">\u52a0\u8f7d\u4e2d...</option>';
                            loadLake2Buildings(function(blds) {
                                elecBuildingSel.innerHTML = '<option value="">\u9009\u62e9\u697c\u680b</option>';
                                camp.buildings = blds;
                                blds.forEach(function(b, bi) { elecBuildingSel.appendChild(makeElement('option', { value:String(bi) }, { innerHTML: b[1] })); });
                            });
                        } else {
                            camp.buildings.forEach(function(b, bi) { elecBuildingSel.appendChild(makeElement('option', { value:String(bi) }, { innerHTML: b[1] })); });
                            if (savedCi === ci && typeof savedBi === 'number') elecBuildingSel.value = String(savedBi);
                        }
                        elecFetchBtn.style.display = camp.type === 'lake2' ? 'none' : '';
                        elecQueryBtn.style.flex = camp.type === 'lake2' ? '1' : '';
                    }
                    saveElec();
                };
                if (elecCampusSel.value !== '') elecCampusSel.onchange();
                elecBuildingSel.onchange = saveElec;
                elecRoomInp.oninput = saveElec;

                function saveElec() {
                    var ci = parseInt(elecCampusSel.value) || null;
                    var bi = parseInt(elecBuildingSel.value) || null;
                    GM_setValue('elecCampusIdx', ci);
                    GM_setValue('elecBuildingIdx', bi);
                    GM_setValue('elecRoomName', elecRoomInp.value.trim());
                }

                function getElecSel() {
                    var ci = parseInt(elecCampusSel.value);
                    var bi = parseInt(elecBuildingSel.value);
                    if (isNaN(ci) || isNaN(bi) || ci >= ELE_CAMPUSES.length || bi >= ELE_CAMPUSES[ci].buildings.length) return null;
                    var c = ELE_CAMPUSES[ci];
                    return { type: c.type || 'old', client: c.client, buildingId: c.buildings[bi][0], buildingName: c.buildings[bi][1], roomName: elecRoomInp.value.trim() };
                }

                // Electricity request helper
                var elecSession = {};
                function elecRequest(opts, callback) {
                    var req = {
                        method: opts.method || 'GET',
                        url: 'http://192.168.84.3:9090' + opts.path,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
                        timeout: 15000,
                        onload: function(resp) {
                            var rh = resp.responseHeaders || '';
                            var cookies = rh.match(/Set-Cookie:\s*([^;\n]+)/gi);
                            if (cookies) {
                                cookies.forEach(function(c) {
                                    var kv = c.replace(/^Set-Cookie:\s*/i, '').split(';')[0].trim();
                                    var eq = kv.indexOf('=');
                                    if (eq > 0) elecSession[kv.substring(0, eq)] = kv.substring(eq + 1);
                                });
                            }
                            callback(resp.responseText);
                        },
                        onerror: function() {
                            elecFetchBtn.disabled = false; elecQueryBtn.disabled = false;
                            elecStatus.textContent = '\u7f51\u7edc\u9519\u8bef'; elecStatus.style.color = 'red';
                        },
                        ontimeout: function() {
                            elecFetchBtn.disabled = false; elecQueryBtn.disabled = false;
                            elecStatus.textContent = '\u8bf7\u6c42\u8d85\u65f6'; elecStatus.style.color = 'red';
                        }
                    };
                    if (opts.data) { req.data = opts.data; req.headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
                    var cookieStr = Object.keys(elecSession).map(function(k) { return k + '=' + elecSession[k]; }).join('; ');
                    if (cookieStr) req.headers['Cookie'] = cookieStr;
                    GM_xmlhttpRequest(req);
                }

                // Fetch room ID
                elecFetchBtn.onclick = function() {
                    var sel = getElecSel();
                    if (!sel || !sel.roomName) { elecStatus.textContent = '\u8bf7\u5148\u9009\u62e9\u6821\u533a\u3001\u697c\u680b\u5e76\u8f93\u5165\u623f\u95f4\u53f7'; elecStatus.style.color = 'red'; return; }
                    elecStatus.textContent = '\u6b63\u5728\u83b7\u53d6...'; elecStatus.style.color = '#999';
                    elecFetchBtn.disabled = true; elecQueryBtn.disabled = true;
                    elecSession = {};
                    console.log('[SZU] Fetch roomId:', sel.client, sel.buildingId, sel.roomName);

                    elecRequest({path:'/cgcSims/'}, function(html) {
                        var formBody = 'client=' + encodeURIComponent(sel.client) + '&buildingId=' + encodeURIComponent(sel.buildingId) + '&roomName=' + encodeURIComponent(sel.roomName) + '&select=+%E6%9F%A5%E8%AF%A2+';
                        var hiddenRe = /<input[^>]*type\s*=\s*["']hidden["'][^>]*>/gi;
                        var hiddenInputs = html.match(hiddenRe) || [];
                        hiddenInputs.forEach(function(inp) {
                            var nm = inp.match(/name\s*=\s*["']([^"']+)["']/i);
                            var vl = inp.match(/value\s*=\s*["']([^"']*)["']/i);
                            if (nm && nm[1] !== 'client' && nm[1] !== 'buildingId' && nm[1] !== 'roomName')
                                formBody += '&' + encodeURIComponent(nm[1]) + '=' + encodeURIComponent(vl ? vl[1] : '');
                        });
                        elecRequest({method:'POST', path:'/cgcSims/login.do', data:formBody}, function(html2) {
                            elecFetchBtn.disabled = false; elecQueryBtn.disabled = false;
                            var m2 = html2.match(/name="roomId"[^>]*value="(\d+)"/);
                            if (m2) {
                                GM_setValue('elecRoomId', m2[1]);
                                elecStatus.textContent = 'ID: ' + m2[1]; elecStatus.style.color = 'green';
                            } else {
                                elecStatus.textContent = '\u83b7\u53d6\u5931\u8d25'; elecStatus.style.color = 'red';
                            }
                        });
                    });
                };

                // Render electricity data
                function renderElecData(html) {
                    var tableStart = html.indexOf('class="datalist"');
                    if (tableStart < 0) tableStart = html.indexOf("class='datalist'");
                    if (tableStart < 0) tableStart = html.indexOf('bgcolor="#a5e5aa"');
                    var tblTag = html.lastIndexOf('<table', tableStart);
                    var tblEnd = html.indexOf('</table>', tableStart);
                    var tblHtml = tblTag >= 0 ? html.substring(tblTag, tblEnd > 0 ? tblEnd + 8 : html.length) : html;

                    var rows = [];
                    var rowRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
                    var rm;
                    while ((rm = rowRe.exec(tblHtml)) !== null) {
                        var cells = [];
                        var cellRe = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
                        var cm;
                        while ((cm = cellRe.exec(rm[1])) !== null) cells.push(cm[1].replace(/<[^>]+>/g, '').replace(/&nbsp;/g, '').trim());
                        if (cells.length > 0) rows.push(cells);
                    }
                    if (rows.length <= 1) return false;

                    var headerRow = rows[0];
                    var colMap = {};
                    for (var c = 0; c < headerRow.length; c++) {
                        var h = headerRow[c];
                        if (h.indexOf('\u65e5\u671f') >= 0) colMap.date = c;
                        if (h.indexOf('\u5269\u4f59') >= 0) colMap.rest = c;
                        if (h.indexOf('\u603b\u7528\u7535') >= 0) colMap.usage = c;
                        if (h.indexOf('\u603b\u8d2d\u7535') >= 0) colMap.purchase = c;
                    }
                    var dataRows = [];
                    for (var i = 1; i < rows.length; i++) {
                        var r = rows[i];
                        if (r.length < 4) continue;
                        var dt = (r[colMap.date] || '').substring(0, 10);
                        if (!dt.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
                        dataRows.push({
                            date: dt,
                            rest: parseFloat(r[colMap.rest]) || 0,
                            usage: parseFloat(r[colMap.usage]) || 0,
                            purchase: parseFloat(r[colMap.purchase]) || 0
                        });
                    }
                    if (dataRows.length === 0) return false;

                    var html2 = '<table style="width:100%;border-collapse:collapse;font-size:11px">';
                    html2 += '<tr style="background:#1a1a2e;color:#fff"><th>\u65e5\u671f</th><th>\u5f53\u65e5\u7528\u7535</th><th>\u53ef\u7528</th><th>\u5145\u7535</th></tr>';
                    for (var i = 0; i < dataRows.length; i++) {
                        var d = dataRows[i];
                        var dailyUse = '-', dailyCharge = '-';
                        if (i > 0) {
                            dailyCharge = (d.purchase - dataRows[i-1].purchase).toFixed(2);
                            if (parseFloat(dailyCharge) < 0.01) dailyCharge = '-';
                            dailyUse = (dataRows[i-1].rest - d.rest + (dailyCharge === '-' ? 0 : parseFloat(dailyCharge))).toFixed(2);
                        }
                        html2 += '<tr style="' + (i%2===0?'background:#333':'') + '"><td style="padding:2px 4px;text-align:center">' + d.date.substring(5) + '</td>';
                        html2 += '<td style="padding:2px 4px;text-align:center">' + dailyUse + '</td>';
                        html2 += '<td style="padding:2px 4px;text-align:center">' + d.rest.toFixed(2) + '</td>';
                        html2 += '<td style="padding:2px 4px;text-align:center">' + dailyCharge + '</td></tr>';
                    }
                    html2 += '</table>';
                    elecResTable.innerHTML = html2;
                    elecResTable.style.display = 'block';
                    elecStatus.textContent = '\u67e5\u8be2\u5b8c\u6210\uff0c\u5171 ' + dataRows.length + ' \u6761\uff08\u53ef\u7528 ' + dataRows[dataRows.length-1].rest.toFixed(2) + ' \u5ea6\uff09';
                    elecStatus.style.color = 'green';
                    return true;
                }

                // Query button
                elecQueryBtn.onclick = function() {
                    var sel = getElecSel();
                    if (!sel || !sel.roomName) { elecStatus.textContent = '\u8bf7\u5148\u9009\u62e9\u6821\u533a\u3001\u697c\u680b\u5e76\u8f93\u5165\u623f\u95f4\u53f7'; elecStatus.style.color = 'red'; return; }
                    elecStatus.textContent = '\u6b63\u5728\u67e5\u8be2...'; elecStatus.style.color = '#999';
                    elecResTable.style.display = 'none';
                    elecFetchBtn.disabled = true; elecQueryBtn.disabled = true;

                    if (sel.type === 'lake2') { queryLake2(sel.buildingId, sel.roomName); return; }

                    elecSession = {};
                    elecRequest({path:'/cgcSims/'}, function(html) {
                        var formBody = 'client=' + encodeURIComponent(sel.client) + '&buildingId=' + encodeURIComponent(sel.buildingId) + '&roomName=' + encodeURIComponent(sel.roomName) + '&select=+%E6%9F%A5%E8%AF%A2+';
                        var hiddenRe = /<input[^>]*type\s*=\s*["']hidden["'][^>]*>/gi;
                        var hiddenInputs = html.match(hiddenRe) || [];
                        hiddenInputs.forEach(function(inp) {
                            var nm = inp.match(/name\s*=\s*["']([^"']+)["']/i);
                            var vl = inp.match(/value\s*=\s*["']([^"']*)["']/i);
                            if (nm && nm[1] !== 'client' && nm[1] !== 'buildingId' && nm[1] !== 'roomName')
                                formBody += '&' + encodeURIComponent(nm[1]) + '=' + encodeURIComponent(vl ? vl[1] : '');
                        });
                        elecRequest({method:'POST', path:'/cgcSims/login.do', data:formBody}, function(html2) {
                            elecFetchBtn.disabled = false; elecQueryBtn.disabled = false;
                            var m2 = html2.match(/name="roomId"[^>]*value="(\d+)"/);
                            if (m2) GM_setValue('elecRoomId', m2[1]);
                            if (!renderElecData(html2)) {
                                var today = new Date();
                                var toDS = function(d) { return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); };
                                var startDate = new Date(today.getTime() - 1000*86400*13);
                                var fStart = html2.indexOf('<form');
                                var fEnd = html2.indexOf('</form>', fStart);
                                var fHtml = fStart >= 0 ? html2.substring(fStart, fEnd > 0 ? fEnd : html2.length) : '';
                                var sParts = ['hiddenType=','isHost=0','beginTime='+toDS(startDate),'endTime='+toDS(today),'type=2','client='+encodeURIComponent(sel.client),'roomId='+(GM_getValue('elecRoomId','')||''),'roomName='+encodeURIComponent(sel.roomName),'building='];
                                var allHidRe = /<input[^>]*type\s*=\s*["']hidden["'][^>]*>/gi;
                                var hms;
                                while ((hms = allHidRe.exec(fHtml)) !== null) {
                                    var nm = hms[0].match(/name\s*=\s*["']([^"']+)["']/i);
                                    var vl = hms[0].match(/value\s*=\s*["']([^"']*)["']/i);
                                    if (nm && nm[1] !== 'client' && nm[1] !== 'buildingId' && nm[1] !== 'roomName' && nm[1] !== 'roomId')
                                        sParts.push(encodeURIComponent(nm[1])+'='+encodeURIComponent(vl?vl[1]:''));
                                }
                                var sBody = sParts.join('&');
                                elecRequest({method:'POST', path:'/cgcSims/selectList.do', data:sBody}, function(html3) {
                                    if (!renderElecData(html3)) { elecStatus.textContent = '\u67e5\u8be2\u4e0d\u5230\u6570\u636e'; elecStatus.style.color = 'red'; }
                                });
                            }
                        });
                    });
                };

                // Lake2 functions
                var LAKE2_BASE = 'http://172.25.100.105:8010';

                function loadLake2Buildings(callback) {
                    GM_xmlhttpRequest({
                        method:'GET', url:LAKE2_BASE+'/Default.aspx', timeout:10000,
                        headers:{'User-Agent':'Mozilla/5.0'},
                        onload:function(r) { var opts = parseSelectOptions(r.responseText,'drlouming'); callback(opts); },
                        onerror:function(){callback([]);}, ontimeout:function(){callback([]);}
                    });
                }

                function parseHidden(html, name) {
                    var re = new RegExp('name="'+name+'"[^>]*value="([^"]*)"','i');
                    var m = html.match(re);
                    return m ? m[1] : '';
                }

                function parseSelectOptions(html, selectName) {
                    var re = new RegExp('<select[^>]*name="'+selectName+'"[^>]*>([\\s\\S]*?)</select>','i');
                    var sm = html.match(re);
                    if (!sm) return [];
                    var opts = [];
                    var optRe = /<option[^>]*value="([^"]*)"[^>]*>([^<]*)<\/option>/gi;
                    var om;
                    while ((om = optRe.exec(sm[1])) !== null) { if (om[1]) opts.push([om[1], om[2].trim()]); }
                    return opts;
                }

                function lake2Post(path, data, callback) {
                    GM_xmlhttpRequest({
                        method:'POST', url:LAKE2_BASE+path,
                        headers:{'User-Agent':'Mozilla/5.0','Content-Type':'application/x-www-form-urlencoded'},
                        data:data, timeout:15000,
                        onload:function(r){callback(r.responseText);},
                        onerror:function(){elecFetchBtn.disabled=false;elecQueryBtn.disabled=false;elecStatus.textContent='\u4e3d\u6e56\u4e8c\u671f\u7f51\u7edc\u9519\u8bef';elecStatus.style.color='red';},
                        ontimeout:function(){elecFetchBtn.disabled=false;elecQueryBtn.disabled=false;elecStatus.textContent='\u8d85\u65f6';elecStatus.style.color='red';}
                    });
                }

                function queryLake2(buildingVal, roomName) {
                    elecStatus.textContent = '\u4e3d\u6e56\u4e8c\u671f\u67e5\u8be2\u4e2d...'; elecStatus.style.color = '#999';
                    lake2Post('/Default.aspx','',function(html){
                        var vs=parseHidden(html,'__VIEWSTATE'),vsg=parseHidden(html,'__VIEWSTATEGENERATOR'),ev=parseHidden(html,'__EVENTVALIDATION');
                        var fd='__VIEWSTATE='+encodeURIComponent(vs)+'&__VIEWSTATEGENERATOR='+encodeURIComponent(vsg)+'&__EVENTVALIDATION='+encodeURIComponent(ev);
                        var fd2=fd+'&__EVENTTARGET=drlouming&__EVENTARGUMENT=&drlouming='+encodeURIComponent(buildingVal);
                        lake2Post('/Default.aspx',fd2,function(html2){
                            var vs2=parseHidden(html2,'__VIEWSTATE'),vsg2=parseHidden(html2,'__VIEWSTATEGENERATOR'),ev2=parseHidden(html2,'__EVENTVALIDATION');
                            var floors=parseSelectOptions(html2,'drceng');
                            (function tryFloor(idx){
                                if(idx>=floors.length){elecStatus.textContent='\u672a\u627e\u5230\u623f\u95f4: '+roomName;elecStatus.style.color='red';elecFetchBtn.disabled=false;elecQueryBtn.disabled=false;return;}
                                var fv=floors[idx][0];
                                var fd3='__VIEWSTATE='+encodeURIComponent(vs2)+'&__VIEWSTATEGENERATOR='+encodeURIComponent(vsg2)+'&__EVENTVALIDATION='+encodeURIComponent(ev2)+'&__EVENTTARGET=drceng&drceng='+encodeURIComponent(fv)+'&drlouming='+encodeURIComponent(buildingVal);
                                lake2Post('/Default.aspx',fd3,function(html3){
                                    var rooms=parseSelectOptions(html3,'drfangjian');
                                    var found=null;
                                    for(var ri=0;ri<rooms.length;ri++){if(rooms[ri][0].indexOf(roomName)>=0||rooms[ri][1].indexOf(roomName)>=0){found=rooms[ri][0];break;}}
                                    if(found){
                                        var vs3=parseHidden(html3,'__VIEWSTATE'),vsg3=parseHidden(html3,'__VIEWSTATEGENERATOR'),ev3=parseHidden(html3,'__EVENTVALIDATION');
                                        var fd4='__VIEWSTATE='+encodeURIComponent(vs3)+'&__VIEWSTATEGENERATOR='+encodeURIComponent(vsg3)+'&__EVENTVALIDATION='+encodeURIComponent(ev3)+'&drfangjian='+encodeURIComponent(found)+'&radio=usedR&ImageButton1.x=1&ImageButton1.y=1';
                                        lake2Post('/Default.aspx',fd4,function(html4){
                                            var vs4=parseHidden(html4,'__VIEWSTATE'),vsg4=parseHidden(html4,'__VIEWSTATEGENERATOR'),ev4=parseHidden(html4,'__EVENTVALIDATION');
                                            var today=new Date();
                                            var toDS=function(d){return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
                                            var start=new Date(today.getTime()-1000*86400*13);
                                            var fd5='__VIEWSTATE='+encodeURIComponent(vs4)+'&__VIEWSTATEGENERATOR='+encodeURIComponent(vsg4)+'&__EVENTVALIDATION='+encodeURIComponent(ev4)+'&txtstart='+toDS(start)+'&txtend='+toDS(today)+'&btnser=\u67e5\u8be2';
                                            lake2Post('/usedRecord.aspx',fd5,function(html5){
                                                elecFetchBtn.disabled=false;elecQueryBtn.disabled=false;
                                                var rm=html5.match(/\u5269\u4f59\u7535\u91cf[\uff1a:]\s*<[^>]*>\s*([-\d.]+)\s*</i);
                                                var remaining=rm?rm[1]:'?';
                                                var dataRows=[];
                                                var rowRe=/<tr class="contentLine">([\s\S]*?)<\/tr>/gi;
                                                var rm2;
                                                while((rm2=rowRe.exec(html5))!==null){
                                                    var cells=[];
                                                    var cellRe=/<td[^>]*>([\s\S]*?)<\/td>/gi;
                                                    var cm;
                                                    while((cm=cellRe.exec(rm2[1]))!==null)cells.push(cm[1].replace(/<[^>]+>/g,'').trim());
                                                    if(cells.length>=3){
                                                        var dt=cells[0].substring(0,10);
                                                        var usage=parseFloat(cells[2])||0;
                                                        var price=cells.length>=4?(parseFloat(cells[3])||0):0;
                                                        if(dt.match(/^\d{4}/))dataRows.push({date:dt,rest:0,usage:usage,purchase:price});
                                                    }
                                                }
                                                if(dataRows.length>0){
                                                    var cur=parseFloat(remaining)||0;
                                                    for(var d=0;d<dataRows.length;d++){dataRows[d].rest=cur;cur+=dataRows[d].usage;}
                                                    var th='<table style="width:100%;border-collapse:collapse;font-size:11px">';
                                                    th+='<tr style="background:#1a1a2e;color:#fff"><th>\u65e5\u671f</th><th>\u7528\u91cf</th><th>\u5269\u4f59</th><th>\u5355\u4ef7</th></tr>';
                                                    for(var i=0;i<dataRows.length;i++){
                                                        var d=dataRows[i];
                                                        th+='<tr style="'+(i%2===0?'background:#333':'')+'"><td style="padding:2px 4px;text-align:center">'+d.date.substring(5)+'</td>';
                                                        th+='<td style="padding:2px 4px;text-align:center">'+d.usage.toFixed(2)+'</td>';
                                                        th+='<td style="padding:2px 4px;text-align:center">'+d.rest.toFixed(2)+'</td>';
                                                        th+='<td style="padding:2px 4px;text-align:center">'+d.purchase.toFixed(2)+'</td></tr>';
                                                    }
                                                    th+='</table>';
                                                    elecResTable.innerHTML=th;elecResTable.style.display='block';
                                                    elecStatus.textContent='\u67e5\u8be2\u5b8c\u6210\uff0c\u5171 '+dataRows.length+' \u6761\uff08\u5269\u4f59 '+remaining+' \u5ea6\uff09';
                                                    elecStatus.style.color='green';
                                                }else{elecStatus.textContent='\u4e3d\u6e56\u4e8c\u671f\u65e0\u6570\u636e';elecStatus.style.color='red';}
                                            });
                                        });
                                    }else{tryFloor(idx+1);}
                                });
                            })(0);
                        });
                    });
                }

                // About + Watermark + Personal info
                body = mainBody;

                // About link
                body.appendChild(makeElement('div', { class: 'panel-divider' }));
                var aboutLink = makeElement('a', { href:'javascript:void(0)' }, { innerHTML:'\u5173\u4e8e\u6211\u4eec' }, { 'font-weight':'bold','color':'#fff','font-size':'13px','cursor':'pointer' });
                aboutLink.onclick = function(e) {
                    e.stopPropagation();
                    var modal = document.getElementById('convenient-szu-about');
                    if (modal) modal.style.display = modal.style.display === 'block' ? 'none' : 'block';
                };
                body.appendChild(aboutLink);

                if (!document.getElementById('convenient-szu-about')) {
                    var aboutModal = makeElement('div', { id:'convenient-szu-about' }, {}, {
                        'display':'none','position':'fixed','top':'0','left':'0','right':'0','bottom':'0',
                        'background':'rgba(0,0,0,.7)','z-index':'2147483647'
                    });
                    var aboutInner = makeElement('div',{}, {},{
                        'background':'#2a2a3e','border-radius':'12px','padding':'24px','max-width':'420px','width':'90%',
                        'color':'#c0c0c0','font-size':'13px','line-height':'1.8','border':'1px solid #e94560',
                        'position':'relative','margin':'80px auto'
                    });
                    aboutInner.innerHTML = '<p style="margin:0 0 12px;color:#999">\u4f60\u597d\uff0c\u6211\u662f\u8fd9\u4e2a\u811a\u672c\u7684\u4f5c\u8005<strong style="color:#fff">\u767d\u7389\u4eac</strong>\uff0c\u8fd9\u4e2a\u811a\u672c\u8131\u80ce\u4e8e <strong style="color:#fff">Convenient SZU</strong> \u811a\u672c\uff0c\u4f5c\u8005\u662f <strong style="color:#fff">cc</strong>\uff0c\u4f60\u4eec\u53ef\u4ee5\u5728 Greasy Fork\uff08\u6cb9\u53c9\uff09\u91cc\u641c\u5230\u4ed6\uff0c\u611f\u8c22\u8fd9\u4f4d\u4f5c\u8005\u7684\u811a\u672c\u3002</p>' +
                        '<p style="margin:0 0 12px;color:#999">\u8fd9\u4e2a\u65b0\u505a\u7684\u811a\u672c\u662f\u4e3a\u4e86\u66f4\u65b9\u4fbf\u6df1\u5927\u540c\u5b66\u7684\u516c\u6587\u901a\u4f7f\u7528\uff0c\u5982\u679c\u4f60\u60f3\u83b7\u5f97\u66f4\u591a\u597d\u73a9\u7684\u6709\u7528\u7684\u4e1c\u897f\uff0c\u6b22\u8fce\u8bbf\u95ee\u6211\u4eec<strong style="color:#fff">101\u907f\u96be\u6240</strong>\u7684\u7f51\u7ad9\uff1a<a href="https://Vault101.top" target="_blank" style="color:#e94560">Vault101.top</a>\uff0c\u540c\u65f6\u4e5f\u53ef\u4ee5\u52a0\u6211\u7684\u5fae\u4fe1\uff1a<strong style="color:#fff">VelvetMoth</strong>\uff0c\u6765\u52a0\u5165\u6211\u4eec101\u907f\u96be\u6240\u7684\u5927\u7fa4\uff0c\u6b64\u7fa4\u80fd\u8ba9\u4f60\u7684\u6df1\u5927\u751f\u6d3b\u5728\u5404\u79cd\u610f\u4e49\u4e0a\u4e8b\u534a\u529f\u500d\uff0c\u6beb\u4e0d\u5938\u5f20\u3002</p>' +
                        '<p style="margin:0;color:#999">\u6700\u540e\uff0cenjoy\uff01</p>' +
                        '<button style="margin-top:16px;padding:6px 20px;border:none;border-radius:4px;background:#e94560;color:#fff;cursor:pointer;font-size:12px;width:100%" onclick="document.getElementById(\'convenient-szu-about\').style.display=\'none\'">\u5173\u95ed</button>';
                    aboutModal.appendChild(aboutInner);
                    aboutModal.onclick = function(ev) { if (ev.target === aboutModal) aboutModal.style.display = 'none'; };
                    document.body.appendChild(aboutModal);
                }

                if (!document.getElementById('convenient-szu-watermark')) {
                    var wm = makeElement('div', { id:'convenient-szu-watermark' }, { innerHTML:'101\u907f\u96be\u6240\u51fa\u54c1' });
                    document.body.appendChild(wm);
                }

                // Personal info
                body.appendChild(makeElement('div', { class:'panel-divider' }));
                body.appendChild(makeElement('div', { class:'panel-info-title' }, { innerHTML:'\u4e2a\u4eba\u4fe1\u606f\u7ed1\u5b9a' }));

                var uid = makeElement('input', { id:'uid', type:'number', placeholder:'10\u4f4d\u6570\u5b66\u53f7' });
                var cid = makeElement('input', { id:'cid', type:'number', placeholder:'6\u4f4d\u6570\u6821\u56ed\u5361\u53f7' });
                var pwd = makeElement('input', { id:'pwd', type:'password', placeholder:'\u7edf\u4e00\u8ba4\u8bc1\u767b\u5f55\u5bc6\u7801' });
                if (account.uid) uid.value = account.uid;
                if (account.cid) cid.value = account.cid;
                if (account.pwd) pwd.value = account.pwd;

                var btn = makeElement('button', { class:'panel-btn' }, { innerHTML:'\u66f4\u65b0\u4fe1\u606f' }, {}, {
                    click:function() {
                        var uv = document.getElementById('uid').value;
                        var cv = document.getElementById('cid').value;
                        var pv = document.getElementById('pwd').value;
                        if (!uv.match(/^\d{10}$/)) { showToast('\u5b66\u53f7\u5fc5\u987b\u4e3a10\u4f4d\u6570','warning'); return false; }
                        if (!cv.match(/^\d{6}$/)) { showToast('\u6821\u56ed\u5361\u53f7\u5fc5\u987b\u4e3a6\u4f4d\u6570','warning'); return false; }
                        if (!pv) { showToast('\u5bc6\u7801\u4e0d\u80fd\u4e3a\u7a7a','warning'); return false; }
                        account.uid=uv; account.cid=cv; account.pwd=pv;
                        GM_setValue('account', account);
                        showToast('\u4fe1\u606f\u66f4\u65b0\u6210\u529f','success');
                    }
                });
                body.appendChild(uid); body.appendChild(cid); body.appendChild(pwd); body.appendChild(btn);

                toggle.onclick = function(e) { e.stopPropagation(); body.classList.toggle('open'); };
                document.addEventListener('click', function(e) { if (!panel.contains(e.target)) body.classList.remove('open'); });

                panel.appendChild(toggle);
                panel.appendChild(body);
                if (document.body) { document.body.appendChild(panel); console.log('[SZU] Panel injected on', location.href); }
            } catch(err) { console.error('[SZU] Panel failed:', err); }
        })();
    }

    // jQuery-dependent features
    if (typeof $ !== 'undefined') {
        // BubbleMessage fallback
        if (typeof BubbleMessage === 'undefined') {
            var BubbleMessage = function() {};
            BubbleMessage.prototype.message = function(opts) {
                var t = document.createElement('div');
                t.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:10px 24px;border-radius:6px;color:#fff;font-size:14px;box-shadow:0 2px 12px rgba(0,0,0,.25);' + (opts.type==='success'?'background:#52c41a;':opts.type==='warning'?'background:#ff4d4f;':'background:#1890ff;');
                t.textContent = opts.message || '';
                document.body.appendChild(t);
                setTimeout(function(){t.remove();},opts.duration||2000);
            };
        }

        $(document).ready(function() {
            console.log('SZU Assistant version ' + __VERSION__);
            var bm = new BubbleMessage();

            // Board page features
            if (location.host.match(/www1.*?\.szu\.edu\.cn/)) {
                if (location.href.indexOf('/board/infolist') >= 0) {
                    function meets(_ct,_in) { for (var it of _in) if (_ct.match(it)) return true; return false; }
                    function generateCheckbox(_id,_ct,_fn) {
                        var cb = makeElement('input',{id:_id,type:'checkbox',checked:'false'},{},{'margin-right':'5px'},{change:_fn});
                        var lb = makeElement('label',{for:_id},{innerHTML:_ct});
                        var ct = makeElement('span',{},{},{'font-size':'13px','display':'inline-flex','align-items':'center','margin-right':'10px','position':'relative','top':'2px'});
                        ct.appendChild(cb); ct.appendChild(lb); return ct;
                    }
                    function setCheckbox() {
                        var ck = generateCheckbox('show-only-college','\u53ea\u770b\u5b66\u9662\u5b66\u90e8', function(ev) {
                            var _in = [/.*?\u5b66\u9662.*/, /.*?\u5b66\u90e8.*/];
                            var tc = document.querySelectorAll('[valign=top]')[3];
                            var arts = [].slice.call(tc.querySelectorAll('table>tbody>tr')).slice(2);
                            var nma = arts.filter(function(el){return !meets(el.querySelector('td:nth-child(3)>a').innerText,_in);});
                            var nmd = [].slice.call(document.querySelectorAll('select[name=from_username]>option')).filter(function(el){return !meets(el.value,_in);});
                            if (ev.target.checked) { nmd.forEach(function(el){el.style.display='none';}); nma.forEach(function(el){el.style.display='none';}); }
                            else { nmd.forEach(function(el){el.style.display='';}); nma.forEach(function(el){el.style.display='';}); }
                        });
                        var ne = document.querySelector('select[name=dayy]');
                        var td = ne.parentElement; td.style.width='500px'; td.insertBefore(ck,ne);
                    }
                    function updateSelect() {
                        var se = document.querySelector('input#show-only-college');
                        se.addEventListener('change',function(ev){account.boardShowOnlyChecked=ev.target.checked;GM_setValue('account',account);});
                        if (typeof account.boardShowOnlyChecked !== 'boolean') {account.boardShowOnlyChecked=se.checked;GM_setValue('account',account);}
                        else if (se.checked !== account.boardShowOnlyChecked) se.click();
                        var de = document.querySelector('select[name=dayy]');
                        de.addEventListener('change',function(ev){account.boardDayySelectedIndex=ev.target.selectedIndex;GM_setValue('account',account);});
                        if (typeof account.boardDayySelectedIndex !== 'number') {account.boardDayySelectedIndex=de.selectedIndex;GM_setValue('account',account);}
                        else if (de.selectedIndex !== account.boardDayySelectedIndex) de.selectedIndex=account.boardDayySelectedIndex;
                        var fe = document.querySelector('select[name=from_username]');
                        fe.addEventListener('change',function(ev){account.boardDeptSelectedIndex=ev.target.selectedIndex;GM_setValue('account',account);});
                        if (typeof account.boardDeptSelectedIndex !== 'number') {account.boardDeptSelectedIndex=fe.selectedIndex;GM_setValue('account',account);}
                        else if (fe.selectedIndex !== account.boardDeptSelectedIndex) fe.selectedIndex=account.boardDeptSelectedIndex;
                        var ke = document.querySelector('input[name=keyword]');
                        ke.addEventListener('input',function(ev){account.boardKeywordValue=ev.target.value;GM_setValue('account',account);});
                        if (typeof account.boardKeywordValue !== 'string') {account.boardKeywordValue=ke.getAttribute('value');GM_setValue('account',account);}
                        else if (ke.getAttribute('value') !== account.boardKeywordValue) {ke.setAttribute('value',account.boardKeywordValue);ke.value=account.boardKeywordValue;}
                    }
                    setCheckbox(); updateSelect();
                }
            } else if (!hasUpdatedInfo) { return; }

            // Function pages
            if (location.host === 'www1.szu.edu.cn') {
                if (location.href.includes('/board/view.asp')) {
                    function removeWatermarks() {
                        var banner = document.querySelector('table tbody tr td table tbody tr td table tbody tr td p font');
                        if (banner) banner.remove();
                        document.querySelectorAll('.mark_div').forEach(function(w){w.remove();});
                    }
                    removeWatermarks(); setTimeout(removeWatermarks, 1500);
                }
            } else if (location.host === 'authserver.szu.edu.cn') {
                execUntil(function() {
                    var pf = document.querySelector('#pwdLoginDiv:not([style*="display: none"]) #pwdFromId') || document.querySelector('#loginViewDiv #pwdFromId');
                    var ct = pf || document;
                    var ue = ct.querySelector('#username') || document.getElementById('username');
                    var pe = ct.querySelector('#password') || document.getElementById('password');
                    var lb = ct.querySelector('#login_submit') || document.getElementById('login_submit');
                    var cd = document.getElementById('captchaDiv');
                    var rm = document.getElementById('rememberMe');
                    if (!ue || !pe || !lb) return;
                    var ch = cd && (cd.classList.contains('hide') || cd.offsetParent === null);
                    if (!ch) { console.log('[SZU] Captcha required, skip'); return; }
                    ue.value = account.cid; pe.value = account.pwd;
                    ue.dispatchEvent(new Event('input',{bubbles:true}));
                    pe.dispatchEvent(new Event('input',{bubbles:true}));
                    if (rm) rm.checked = true;
                    setTimeout(function(){lb.click();},300);
                }, function() {
                    var pf = document.querySelector('#pwdLoginDiv:not([style*="display: none"]) #pwdFromId') || document.querySelector('#loginViewDiv #pwdFromId');
                    var ct = pf || document;
                    return ct.querySelector('#username') && ct.querySelector('#password') && ct.querySelector('#login_submit');
                }, 500);
            } else if (location.host === 'ehall.szu.edu.cn') {
                function insertTabButton() {
                    var adn = $('#ampDesktopNav')[0]; if (!adn) return;
                    function courseClassSorted(courses) {
                        function getPriority(c) {
                            var pr = ['\u57fa\u672c\u901a\u8bc6','\u4e13\u4e1a\u6838\u5fc3','\u4e13\u4e1a\u9650\u9009','\u4e13\u4e1a\u9009\u4fee','\u6269\u5c55\u901a\u8bc6','\u81ea\u7136\u79d1\u5b66','\u751f\u547d\u79d1\u5b66','\u793e\u4f1a\u79d1\u5b66','\u4e2d\u534e\u6587\u5316','\u4eba\u6587\u827a\u672f','\u521b\u65b0\u521b\u4e1a','\u4e2a\u6027\u8bfe\u7a0b','\u57fa\u672c\u5b9e\u8df5'];
                            for (var i=0;i<pr.length;i++) if (c.indexOf(pr[i])>=0) return i; return pr.length;
                        }
                        return courses.map(function(c){return {course:c,priority:getPriority(c)};}).sort(function(a,b){return a.priority-b.priority;}).map(function(o){return o.course;});
                    }
                    function downloadCourseStatistics() {
                        $.ajax({method:'POST',url:'http://ehall.szu.edu.cn/jwapp/sys/xywccx/modules/xywccx/cxscfakz.do',data:{BYNJDM:'-'}}).then(function(res){
                            var ext=['\u81ea\u7136\u79d1\u5b66\u7c7b','\u751f\u547d\u79d1\u5b66\u7c7b','\u793e\u4f1a\u79d1\u5b66\u7c7b','\u4e2d\u534e\u6587\u5316\u7c7b','\u4eba\u6587\u827a\u672f\u7c7b','\u521b\u65b0\u521b\u4e1a\u7c7b'];
                            var nc=['\u4e00','\u4e8c','\u4e09','\u56db','\u4e94','\u516d','\u4e03','\u516b'];
                            var cco=res.datas.cxscfakz.rows;
                            // Basic course stats processing
                            var keys=['\u8bfe\u7a0b\u7c7b\u578b','\u8981\u6c42\u5b66\u5206','\u5df2\u4fee\u5b66\u5206','\u8981\u6c42\u95e8\u6570','\u5df2\u4fee\u95e8\u6570','\u8981\u6c42\u7c7b\u522b\u6570','\u5df2\u4fee\u7c7b\u522b\u6570'];
                            var pc='\u8bfe\u7a0b\u7c7b\u578b,\u8981\u6c42\u5b66\u5206,\u5df2\u4fee\u5b66\u5206,\u8981\u6c42\u95e8\u6570,\u5df2\u4fee\u95e8\u6570,\u8981\u6c42\u7c7b\u522b\u6570,\u5df2\u4fee\u7c7b\u522b\u6570\n';
                            // Simplified: just CSV header
                            var csv='\u8bfe\u7a0b\u540d,\u5b66\u5206,\u6210\u7ee9,\u662f\u5426\u901a\u8fc7,\u5b66\u5e74\u5b66\u671f,\u8bfe\u7a0b\u7c7b\u578b,\u8bfe\u7a0b\u6027\u8d28,\u5907\u6ce8\n';
                            var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8;'});
                            var a=document.createElement('a'); a.download='\u4fee\u8bfb\u8bfe\u7a0b\u7edf\u8ba1.csv'; a.target='_blank';
                            a.href=URL.createObjectURL(blob); document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            bm.message({type:'success',message:'\u4fee\u8bfb\u8bfe\u7a0b\u7edf\u8ba1\u8868\u683c\u751f\u6210\u6210\u529f',duration:2000});
                        });
                    }
                    function setTab() {
                        var ssc=adn.firstElementChild;
                        var div=makeElement('div',{id:'download-training-program',class:ssc.className.replace(/\s?amp-active/,''),title:'\u4fee\u8bfb\u8bfe\u7a0b\u7edf\u8ba1\u4e0b\u8f7d'},{innerHTML:'\u4fee\u8bfb\u8bfe\u7a0b\u7edf\u8ba1\u4e0b\u8f7d'},{},{click:function(){setTimeout(function(){downloadCourseStatistics();},500);}});
                        var prev=ssc; while(prev.nextElementSibling) prev=prev.nextElementSibling;
                        prev.parentElement.insertBefore(div,prev.nextElementSibling);
                    }
                    execUntil(setTab,function(){return $('#ampDesktopNav')[0] && $('#ampDesktopNav')[0].firstElementChild;});
                }
                var anh=document.getElementById('ampHasNoLogin');
                if (anh && sessionStorage.ampUserId==='guest') { anh.click(); insertTabButton(); }
                if (sessionStorage.ampUserId !== 'guest') {
                    if (location.href.includes('/jwapp/sys/jwwspj')) {
                        execUntil(function(){
                            var title=document.getElementsByClassName('timu-title')[0];
                            var btn=makeElement('button',{id:'quick-set'},{innerHTML:'\u4e00\u952e\u4e94\u661f+\u8bc4\u4ef7'},{'border':'0','width':'300px','height':'40px','margin-left':'10px','font-weight':'bold','font-size':'16px','color':'white','background-color':'#d22e2e'},{click:function(){
                                var sb=document.querySelector('.saveBtn [data-action=\u63d0\u4ea4]');
                                if(sb&&sb.getAttribute('disabled')!==null){bm.message({type:'warning',message:'\u4f60\u5df2\u7ecf\u8bc4\u6559\u8fc7\u4e86',duration:2000});}
                                else if(sb){$('[data-x-bl=100]').toArray().forEach(function(s){s.firstElementChild.click();});$('textarea').val(prompt('\u8bf7\u63d0\u4f9b\u4e00\u4e2a\u9ed8\u8ba4\u7684\u6559\u5e08\u8bc4\u4ef7'));}
                                return false;
                            }});
                            var ti=document.getElementsByClassName('timu-title')[0];
                            ti.parentElement.insertBefore(btn,ti);
                        },function(){return document.getElementsByClassName('timu-title')[0]&&!document.getElementById('quick-set');});
                    } else if (location.href.includes('/new/index.html')) {
                        if ($('#ampDesktopNav')[0]&&!$('#download-training-program')[0]) insertTabButton();
                    }
                }
                execUntil(function(){
                    monitor($('#ampTabContentItem0')[0],['childList','subtree'],function(){$('.appFlag.widget-app-item').attr('amp-unviewabledescription','true');$('.appFlag.amp-app-card-hover-big').attr('amp-unviewabledescription','true');});
                },function(){return $('#ampTabContentItem0')[0];});
                var ascs=$('#ampServiceCenterSearchApps')[0];
                if(ascs){monitor(ascs,['childList','subtree'],function(){$('.appFlag.widget-app-item').attr('amp-unviewabledescription','true');$('.appFlag.amp-app-card-hover-big').attr('amp-unviewabledescription','true');});}
            } else if (location.host === '172.30.255.2') {
                if (location.href.includes('.htm')) {
                    var ue2=document.getElementById('username'),pe2=document.getElementById('password'),se2=document.querySelector('#submit[type=submit]');
                    if(ue2&&pe2&&se2){ue2.value=account.cid;pe2.value=account.pwd;se2.click();}
                }
            } else if (location.host.match(/bkxk.*?\.szu\.edu\.cn/)) {
                var le=document.getElementById('loginName'),lp=document.getElementById('loginPwd');
                if(le&&lp){le.value=account.uid;lp.value=account.pwd;}
            } else if (location.host === 'self.szu.edu.cn') {
                var ae=document.getElementById('account'),pe3=document.getElementById('pass'),se3=document.querySelector('input[type=submit]');
                if(ae&&pe3&&se3){ae.value=account.cid;pe3.value=account.pwd;se3.click();}
            } else if (location.host.match(/authserver.*?\.webvpn.szu.edu.cn/)) {
                var ue4=document.getElementById('username'),pe4=document.getElementById('password'),he=document.querySelector('.iCheck-helper'),bs=document.querySelector('button[type=submit]');
                if(ue4&&pe4&&he&&bs){he.click();ue4.setAttribute('value',account.cid);pe4.setAttribute('value',account.pwd);bs.click();}
            }
        });
    } else {
        console.warn('[SZU] jQuery not loaded, some features unavailable');
    }
})();
