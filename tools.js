window.CRS = {};

CRS.templateCache = {};
CRS.components = {};

CRS.getTpl = function(id){
    return '<div>' + CNS.$(id).innerHTML + '</div>';
}

CRS.removeHTML = function removeHTMLTag(str) {
    str = str.replace(/<\/?[^>]*>/g,''); //去除HTML tag
    // str = str.replace(/[ | ]*\n/g,'\n'); //去除行尾空白
    //str = str.replace(/\n[\s| | ]*\r/g,'\n'); //去除多余空行
    str=str.replace(/&nbsp;/ig,'');//去掉&nbsp;
    return str;
}

CRS.legelName = function(name){
    name = name || '';
    if(name){
        return new Date().getTime();
    }
    name = name.split('./').join('-');
    name = name.split('.').join('-');
    name = name.split('/').join('-');
    return name;
}

CRS.getTemplate = function(name, url){
    name = CRS.legelName(name);
    var tpl = CRS.templateCache[name];
    if (tpl) {
        return tpl;
    }

    var xhr = new XMLHttpRequest();
    xhr.open('get', url, false);
    xhr.send(null);

    if (xhr.readyState == 4 && xhr.status == 200) {
        tpl = '<div>' + xhr.responseText + '</div>';
        CRS.templateCache[name] = tpl;
        return tpl;
    }
    //https://developer.mozilla.org/zh-CN/docs/Web/API/Body/text
}

CRS.log = function(params){
    // if(CRS.config.debug){
    console.log(params);
    // }
}

CRS.ua = function(){
    var UA = navigator.userAgent.toLowerCase();
    return  (UA.indexOf('msie')>-1) ? UA.split('; ')[1].split(' ').join('/') :
        (UA.indexOf('chrome')>-1) ? ('chrome' + UA.split('chrome')[1]).split(' ')[0] :
            (UA.indexOf('firefox')>-1) ? 'firefox' + UA.split('firefox')[1] :
                (UA.indexOf('safari')>-1) ? 'safari' + UA.split('safari')[1] :
                    (UA.indexOf('opera')>-1) ? UA.split(' ')[0] : UA;
};


CRS.getFullAPI = function(api){
    var base = '/';
    if(api.indexOf('http') == 0){
        return api;
    }
    return base + api;
}

CRS.fetch = function(params, callback){
    var data = params.data || {};
    var url = params.url;
    var method = params.method || 'GET';

    var _headers = params.headers || {};
    var headers = new Headers({
        'Content-Type': _headers['content-type'] || 'application/json',
        'loginToken': _headers.token || 'no token'
    });

    fetch(url, {
        headers: headers,
        method: method.toUpperCase(),
        // credentials: 'include'
    }).then(function(response){
        //打印返回的json数据
        response.json().then(function(data){
            callback(data);
        })
    }).catch(function(e){
        console.log('error: ' + e.toString());
    });
}


//patch
CRS.patch = function(params, callback){
    var data = params.data || {};
    var url = params.url;
    var method = params.method || 'POST';

    var _headers = params.headers || {};
    var headers = new Headers({
        'Content-Type': _headers['content-type'] || 'application/json',
        'loginToken': _headers.token || 'no token'
    });

    // console.log('tools', params, headers, method, data);

    fetch(url, {
        headers: headers,
        method: method.toUpperCase(),
        credentials: 'include',
        body: JSON.stringify(data)
    }).then(function(response){
        //打印返回的json数据
        response.json().then(function(data){
            callback(data);
        })
    }).catch(function(e){
        callback({code:'fail'});
        console.log('error: ' + e.toString());
    });
}

//post
CRS.post = function(params, callback){
    var data = params.data || {};
    var url = params.url;
    // var token = CRS.cache.get('token') || 'fake token';
    fetch(url, {
        headers: new Headers({
            'Content-Type': 'application/json'
        }),
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify(data)
    }).then(function(response){
        //打印返回的json数据
        response.json().then(function(data){
            callback(data);
        })
    }).catch(function(e){
        callback({code:'fail'});
        console.log('error: ' + e.toString());
    });
}

//postForm
CRS.postForm = function(params, callback){
    var data = params.data || {};
    var url = params.url;
    // var token = CRS.cache.get('token') || 'fake token';

    var _headers = params.headers || {};
    var headers = new Headers({
        'loginToken': _headers.token || 'no token'
    });
    fetch(url, {
        headers: headers,
        method: 'POST',
        credentials: 'include',
        body: data
    }).then(function(response){
        //打印返回的json数据
        response.json().then(function(data){
            callback(data);
        })
    }).catch(function(e){
        callback({code:'fail'});
        console.log('error: ' + e.toString());
    });
}

CRS.loadJS = function(links,callback){
    var total = links.length;
    var steps = 0;

    for(var i=0;i<links.length;i++){
        load(links[i]);
    }

    function load(url){
        var node = document.createElement("script");
        node.src = url;
        document.getElementsByTagName('head')[0].appendChild(node);
        node.onload = function(){
            steps += 1;
            if( steps >= total ){
                callback && callback();
            }
        };
    }
}

CRS.loadLib = function(libConfig, callback){
    if(typeof libConfig == 'string'){
        libConfig = CRS.res[libConfig];
    }
    if(libConfig.isLoaded){
        callback && callback();
        return;
    }
    var core = libConfig.core;
    var plugins = libConfig.plugins;

    CRS.loadJS(core, function(){
        if(!plugins){
            callback && callback();
            return;
        }
        CRS.loadJS(plugins, function(){
            libConfig.isLoaded = true;
            callback && callback();
        });
    });
}

CRS.isEmptyJson = function(json){
    var times = 0;
    var steps = 0;
    for(var prop in json){
        times += 1;
        if(json[prop]){
            steps += 1;
        }
    }
    // console.log(json)
    // console.log(times, steps)
    return times != steps;
}

CRS.jsonMerge = function(a, b, isWrite, filter){
    for (var prop in b)
        if (isWrite || typeof a[prop] === 'undefined' || a[prop] === null)
            a[prop] = filter ? filter(b[prop]) : b[prop];
    return a;
}

CRS.guid = function(){
    return 'mf-' + (Math.random() * (1 << 30)).toString(16).replace('.', '');
}

CRS.trim = {
    left : function(str){
        return str.replace( /^\s*/, '');
    },
    right : function(str){
        return str.replace(/(\s*$)/g, "");
    },
    both : function(str){
        return str.replace(/^\s+|\s+$/g,"");
    },
    all : function(str){
        return str.replace(/\s+/g,"");
    }
}

//cache
CRS.cache = (function() {
    /*
    说明：
    1: JSON.stringfy --> set --> get --> JSON.parse
    2: data format well return as set`s
    3: undefined in array will be null after stringfy+parse
    4: NS --> namespace 缩写
    */
    var keyNS = 'shuise-default-';

    function get(key) {
        /*
        legal data: "" [] {} null flase true

        illegal: undefined
            1: key not set
            2: key is cleared
            3: key removed
            4: wrong data format
        */
        var tempKey = keyNS + key;
        if (!isKeyExist(tempKey)) {
            return null;
        }
        // maybe keyNS could avoid conflict
        var val = localStorage.getItem(tempKey) || sessionStorage.getItem(tempKey);
        val = JSON.parse(val);
        // val format check
        if (val !== null
            && Object.prototype.hasOwnProperty.call(val, 'type')
            && Object.prototype.hasOwnProperty.call(val, 'data')) {
            return val.data;
        }
        return null;
    }
    // isPersistent
    function set(key, val, isTemp) {
        var store;
        if (isTemp) {
            store = sessionStorage;
        } else {
            store = localStorage;
        }
        store.setItem(keyNS + key, JSON.stringify({
            data: val,
            type: (typeof val)
        }));
    }

    function remove(key) {
        var tempKey = keyNS + key;
        localStorage.removeItem(tempKey);
        sessionStorage.removeItem(tempKey);
    }

    function isKeyExist(key) {
        // do not depend on value cause of ""和0
        return Object.prototype.hasOwnProperty.call(localStorage, key)
            || Object.prototype.hasOwnProperty.call(sessionStorage, key);
    }

    function setKeyNS(NS) {
        var isString = typeof NS === 'string';
        if (isString && NS !== '') {
            keyNS = NS;
        }
    }

    return {
        setKeyNS: setKeyNS,
        get: get,
        set: set,
        remove: remove
    };
})();


CRS.subs = function(temp, data, regexp){
    if(!(Object.prototype.toString.call(data) === "[object Array]")) data = [data];
    var ret = [];
    for (var i = 0, j = data.length; i < j; i++) {
        ret.push(replaceAction(data[i]));
    }
    return ret.join("");
    function replaceAction(object){
        return temp.replace(regexp || (/\\?\{([^}]+)\}/g), function(match, name){
            if (match.charAt(0) == '\\') return match.slice(1);
            return (object[name] != undefined) ? object[name] : '';
        });
    }
}

CRS.getPara = function(url,name){
    // url = url.split("&apm;").join("&");
    if(url == ''){
        return '';
    }

    var v = '', _p = name + '=';

    if(url.indexOf("&" + _p)>-1){
        v = url.split("&" + _p)[1] || '';
    }

    if(url.indexOf("?" + _p)>-1){
        v = url.split("?" + _p)[1] || '';
    }
    v = v.split("&")[0] || '';
    return v;
}

CRS.dateFormat = function(date, fmt) {
    fmt = fmt || 'yyyy-MM-dd hh:mm:ss';
    var dateObj;
    if(date){
        dateObj = new Date(date);
    }else{
        return '';
    }

    var o = {
        "M+" : dateObj.getMonth()+1,                 //月份
        "d+" : dateObj.getDate(),                    //日
        "h+" : dateObj.getHours(),                   //小时
        "m+" : dateObj.getMinutes(),                 //分
        "s+" : dateObj.getSeconds(),                 //秒
        "q+" : Math.floor((dateObj.getMonth()+3)/3), //季度
        "S"  : dateObj.getMilliseconds()             //毫秒
    };
    if(/(y+)/.test(fmt)) {
        fmt=fmt.replace(RegExp.$1, (dateObj.getFullYear()+"").substr(4 - RegExp.$1.length));
    }
    for(var k in o) {
        if(new RegExp("("+ k +")").test(fmt)){
            fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));
        }
    }
    return fmt;
}

CRS.qrcode = function(data, callback){
    var size = 480;
    var url = data.url;

    var logo = data.logo;
    var canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    var context = canvas.getContext("2d");

    var node = document.createElement("div");
    new QRCode(node, url.toString());
    setTimeout(draw, 0);

    function draw(){
        var qcodeOrg = node.getElementsByTagName("img")[0].src;
        var img = new Image();
        img.src  = qcodeOrg;
        context.drawImage(img, 0, 0, size, size);
        // var newImageData = canvas.toDataURL("image/png");
        // callback(newImageData);
        if(!logo){
            let newImageData = canvas.toDataURL("image/png");
            callback(newImageData);
            return;
        }
        var img2 = new Image();
        img2.src  = logo;
        
        img2.onload = function(){
            context.drawImage(img2, 200, 200, 80, 80);
            let newImageData = canvas.toDataURL("image/png");
            callback(newImageData);
        }
    }
}

CRS.getLocalImageData = function(file, callback){
    var reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = function(evt){
        var file = evt.target.result;
        // compressImage(file, function (base64) {
        callback && callback(file);
        // });
        // file = window.URL.createObjectURL(file);
    }
}


CRS.print = function(obj){
    var newWindow = window.open("打印窗口","_blank");
    var docStr = obj.innerHTML;

    newWindow.document.write('<lin' + 'k hr' + 'ef="./css/ent.css?print" re' + 'l="stylesheet" med' + 'ia="pri' + 'nt">');


    newWindow.document.write(docStr);
    newWindow.document.close();
    newWindow.print();
    newWindow.close();
}
