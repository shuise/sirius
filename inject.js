;(function(){
    let cssFiles = [
        "/chrome/pagenote-5.3.13/pagenote.css",
        "/chrome/notes/notes.css"
    ];

    let jsFiles = [
        "/chrome/pagenote-5.3.13/pagenote.js",
        "/chrome/vue-2.6.10.js",
        "/chrome/underscore-1.8.3.js",
        "/chrome/md5-browser.js",
        "/chrome/Readability.js",
        "/chrome/html2md-1.0.js",
        "/chrome/tools.js"
    ];

    let main = "/chrome/notes/notes.js";

    let domains = {
        dev: 'http://localhost:8000',
        prod: 'https://pages.bluetech.top'
    };

    let envi = 'dev';
    let r = Math.random();

    loadCSS(cssFiles, function(){
        loadJS(jsFiles, function(){
            loadJS([main], function(){
            });
        })
    });

    function loadJS(links, callback){
        var total = links.length;
        var steps = 0;

        for(var i=0;i<links.length;i++){
            load(domains[envi] + links[i]);
        }

        function load(url){
            var node = document.createElement("script");
            node.src = url + '?v=' + r;
            document.getElementsByTagName('head')[0].appendChild(node);
            node.onload = function(){
                steps += 1;
                if( steps >= total ){
                    callback && callback();
                }
            };
        }
    }

    function loadCSS(links, callback){
        var total = links.length;
        var steps = 0;

        for(var i=0;i<links.length;i++){
            load(domains[envi] + links[i]);
        }

        function load(url){
            url += '?v=' + r;
            var img = new Image();
            img.src = url;
            img.onerror = function(){
                let node = document.createElement('link');
                node.href = url;
                node.rel = "stylesheet";
                document.getElementsByTagName('head')[0].appendChild(node);
                steps += 1;
                if( steps >= total ){
                    callback && callback();
                }
            };
        }
    }
})();