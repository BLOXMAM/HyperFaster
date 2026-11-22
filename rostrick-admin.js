/* RosTrick admin runtime: ملف تكتبه المنصة، لا تعدّله */
(function adminRuntime(CFG) {
    if (window.RTAdmin) return;
    var KEY = "rt_admin_cred";
    function cred() { try { var c = JSON.parse(localStorage.getItem(KEY) || "null"); return c && c.user && c.repo && c.token ? c : null; } catch (e) { return null; } }
    function enc(t) { return btoa(unescape(encodeURIComponent(t))); }
    function dec(t) { return decodeURIComponent(escape(atob(String(t).replace(/\s/g, "")))); }
    function call(path, opt, c) {
      c = c || cred();
      if (!c) return Promise.reject(new Error("سجّل الدخول أولًا."));
      opt = opt || {};
      var h = { "Authorization": "token " + c.token, "Accept": opt.raw ? "application/vnd.github.raw" : "application/vnd.github+json" };
      if (opt.body) h["Content-Type"] = "application/json";
      return fetch("https://api.github.com/repos/" + c.user + "/" + c.repo + path, { method: opt.method || "GET", headers: h, body: opt.body ? JSON.stringify(opt.body) : undefined }).then(function (r) {
        return r.text().then(function (t) {
          var j = null; try { j = JSON.parse(t); } catch (e) {}
          if (!r.ok && !(opt.soft404 && r.status === 404)) {
            var er = new Error(r.status === 401 ? "التوكن غير صحيح أو منتهٍ." : r.status === 403 || r.status === 404 ? "لا صلاحية: تأكد أن التوكن مقيّد بهذا المستودع وفيه صلاحية Contents (قراءة وكتابة)." : (j && j.message) || ("خطأ " + r.status));
            er.status = r.status; throw er;
          }
          return { status: r.status, json: j, text: t };
        });
      }, function () { throw new Error("تعذّر الاتصال بالإنترنت."); });
    }
    function bump() {
      return call("/contents/version.txt", { soft404: true }).then(function (g) {
        var n = 0, sha = "";
        if (g.status !== 404 && g.json) { sha = g.json.sha || ""; try { n = parseInt(dec(g.json.content), 10) || 0; } catch (e) {} }
        var body = { message: "RosTrick admin: version", content: enc(String(n + 1)) }; if (sha) body.sha = sha;
        return call("/contents/version.txt", { method: "PUT", body: body });
      }).then(null, function () {});
    }
    function isAdminLink(l) { return !!(l && /^\/?admin(\/|$)/i.test(String(l.path || ""))); }
    function route(l) {
      try { if (isAdminLink(l) && CFG.page && location.pathname.indexOf(CFG.page) < 0) location.href = CFG.page; } catch (e) {}
    }
    var api = {
      config: CFG,
      isAdminLink: isAdminLink,
      isLoggedIn: function () { return !!cred(); },
      login: function (user, repo, token) {
        var c = { user: String(user || "").trim(), repo: String(repo || "").trim(), token: String(token || "").trim() };
        if (!c.user || !c.repo || !c.token) return Promise.reject(new Error("املأ اسم المستخدم والمستودع والتوكن."));
        return call("", null, c).then(function (r) {
          if (!r.json || !r.json.permissions || !r.json.permissions.push) throw new Error("هذا التوكن لا يملك صلاحية الكتابة على المستودع.");
          try { localStorage.setItem(KEY, JSON.stringify(c)); } catch (e) { throw new Error("تعذّر حفظ الدخول على هذا الجهاز."); }
          return true;
        });
      },
      logout: function () { try { localStorage.removeItem(KEY); } catch (e) {} },
      readJson: function (file) {
        if (!cred()) {
          if (!CFG.worker) return Promise.reject(new Error("سجّل الدخول أولًا."));
          return fetch(CFG.worker + "/" + file + "?_=" + Date.now()).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return { data: d, sha: "" }; });
        }
        return call("/contents/" + file, { soft404: true }).then(function (g) {
          if (g.status === 404) return { data: null, sha: "" };
          var sha = g.json && g.json.sha || "";
          if (g.json && g.json.content) return { data: JSON.parse(dec(g.json.content)), sha: sha };
          return call("/contents/" + file, { raw: true }).then(function (rw) { return { data: JSON.parse(rw.text), sha: sha }; });
        });
      },
      writeJson: function (file, data, sha) {
        var text = JSON.stringify(data, null, 2);
        if (text.length > 900000) return Promise.reject(new Error("حجم الملف كبير جدًا (" + text.length + " حرفًا). قلّل الصور أو العناصر."));
        var get = sha ? Promise.resolve(sha) : call("/contents/" + file, { soft404: true }).then(function (g) { return g.status === 404 ? "" : (g.json && g.json.sha) || ""; });
        return get.then(function (sh) {
          var body = { message: "RosTrick admin: " + file, content: enc(text) }; if (sh) body.sha = sh;
          return call("/contents/" + file, { method: "PUT", body: body });
        }).then(function (r) { return bump().then(function () { return { sha: r.json && r.json.content && r.json.content.sha || "" }; }); });
      },
      imageToDataUrl: function (file, maxSide, quality) {
        return new Promise(function (resolve, reject) {
          if (!file) return reject(new Error("لم تُختر صورة."));
          var fr = new FileReader();
          fr.onerror = function () { reject(new Error("تعذّرت قراءة الصورة.")); };
          fr.onload = function () {
            var im = new Image();
            im.onerror = function () { reject(new Error("هذا الملف ليس صورة صالحة.")); };
            im.onload = function () {
              var m = maxSide || 480, k = Math.min(1, m / Math.max(im.width, im.height)), c = document.createElement("canvas");
              c.width = Math.max(1, Math.round(im.width * k)); c.height = Math.max(1, Math.round(im.height * k));
              c.getContext("2d").drawImage(im, 0, 0, c.width, c.height);
              resolve(c.toDataURL("image/jpeg", quality || 0.7));
            };
            im.src = fr.result;
          };
          fr.readAsDataURL(file);
        });
      }
    };
    window.RTAdmin = api;
    try { if (window.RosTrickLinks && window.RosTrickLinks.getInitial) route(window.RosTrickLinks.getInitial()); } catch (e) {}
    window.addEventListener("rostrick-link", function (e) { route(e && e.detail); });
  })({"worker":"https://hyperfaster.hosaaam-753.workers.dev","files":["games.json"],"page":"admin.html","host":"puzzlelibrary.rostrick.com"});
