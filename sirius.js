(function(){
	let appTpl = `<div class="sirius-wrapper" id="sirius-wrapper" style="display:none">
		<div class="sirius-panel-fold" v-if="siriusType == 'close'">
			<span class="sirius-button" @click="render()">续貂</span>
			<span class="sirius-button" @click="downloadArticle()">下载</span>
		</div>
	</div>`;

	runner();

	function runner(){
		//todo bugfix
		if(!window.Vue){
			return;
		}

		//禁止注入，后期服务器端配置
		let noAllowDomains = [
			'mp.weixin.qq.com'
		];
		let _host = location.host;
		console.log(noAllowDomains.indexOf(_host) == -1)
		console.log(_host);
		if(noAllowDomains.indexOf(_host) == -1){
			return;
		}

		start();
	}

	function start(){
		let app = document.createElement('div');
			app.innerHTML = appTpl;
		document.body.appendChild(app);
		document.querySelector('#sirius-wrapper').style.display = 'block';

		new Vue({
			el: '#sirius-wrapper',
			data: function(){
				return {
					siriusType: 'close',
					pageId: '',
					bookNames: [],
					songs: []
				}
			},
			created: function(){
				let _this = this;
				let url = location.href;
				this.pageId = md5(url);
			},
			mounted: function(){
			},
			methods: {
				getTitle: function(){
					if(location.host.indexOf('.dedao.cn') > -1){
						let obj = document.querySelector('.audio-title');
						return obj.innerText;
					}
					if(location.host.indexOf('.feishu.cn') > -1){
						let obj = document.querySelector('.op-symbol');
						return obj.innerText;
					}

					let h1 = document.querySelector('h1') || {};
					let h2 = document.querySelector('h2') || {};
					let h3 = document.querySelector('h3') || {};
					let title = h1.innerText || h2.innerText  || h3.innerText;
						title = document.title || title || '';

					//title 需要不变，才能提供唯一的连续识别依赖。
					let _title = document.body.innerText.substring(0, 200);
					return title || _title;
				},
				downloadArticle: function(){
					var documentClone = document.cloneNode(true);
					var article = new Readability(documentClone).parse();
					let html = article.content;
					let md = html2md(html);
						md += '\n\n 来源：' + location.href + '\n\n'

					let fileName = this.getTitle();
						fileName = fileName + '-原文.md';
					let file = new File([ md ], fileName, { "type" : "text\/plain" });
				    let objectUrl = URL.createObjectURL(file);
					this.download(objectUrl, fileName);
				},
				download: function(objectUrl, fileName) {
				    const tmpLink = document.createElement("a");
				    tmpLink.href = objectUrl;
				    tmpLink.download = fileName;
				    document.body.appendChild(tmpLink);
				    tmpLink.click();

				    document.body.removeChild(tmpLink);
				    URL.revokeObjectURL(objectUrl);
				},
				render: function(){
					let _this = this;
					let main = document.querySelector('#js_content');
					let sections = main.querySelectorAll('p');

					_.each(sections, function(item){
				        let txt = item.innerText;
						if(!CRS.trim.both(CRS.removeHTML(txt))){
							return;
						}
				        	// txt = _this.links(txt);
				        	txt = _this.bookAndArticle(txt);

				        item.innerHTML = txt;
				        _this.videoPlayers(item);

				        let node = document.createElement('div');
				        	node.className = 'sirius-textarea';
				        	node.contentEditable = true;
				        item.parentNode.insertBefore(node, item.nextSibling);
					});
				},
				bookAndArticle: function(str){
					var pat = new RegExp('《([^《|》]*)》','g');

					var results={};
					do{ 
						var res = pat.exec(str); 
						if(res){
							results[res[1]] = res[1]; 
						}
					}while(res);

					var names = [];
					for(var name in results){
						console.log(name, str);
						let link = '<a href="https://www.amazon.cn/s?k=' + name + '" target="_blank">《' + name + '》</a>';
						str = str.replace('《' + name + '》', link);
						// names.push(name);
						// window.open('https://search.douban.com/book/subject_search?search_text=' + name + '&cat=1001');
						// window.open('https://www.amazon.cn/s?k=' + name);
					}
					return str;
					// console.log(names);
				},
				links: function urlDistinguish(str) {
			        var reg = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig
			        str = str.replace(reg, "<a href='$1' class='feyn-ref-links' target='_blank'>$1</a>")
			        return str;
			    },
				videoPlayers: function(obj) {
			        let links = obj.querySelectorAll('a');
			        for (var i = 0; i < links.length; i++) {
			            //网易云音乐
			            let link = links[i].href;

			            //https://www.bilibili.com/video/BV11p4y1r7te?spm_id_from=333.337.search-card.all.click
			            let biliFlag = 'https://www.bilibili.com/video/';
			            let bibliId = '';
			            if (link.indexOf(biliFlag) == 0) {
			                bibliId = link.split('?')[0];
			                bibliId = bibliId.split(biliFlag)[1];
			                bibliId = bibliId.split('/')[0];
			            }
			            if (bibliId) {
			                let str = '<iframe src="https://player.bilibili.com/player.html?bvid=' + bibliId + '" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" style="height:300px;width:100%;"> </iframe>';
			                appendPlayer(str, links[i]);
			            }

			            //https://v.youku.com/v_show/id_XNTIwNTIwMjk2OA==.html?spm=a2ha1.14919748_WEBHOME_GRAY.homepage_vipyindao.d_zj2_2&scm=20140719.rcmd.27501.video_XNTIwNTIwMjk2OA%3D%3D
			            let youkuFlag = 'https://v.youku.com/v_show/id_';
			            let youkuId = '';
			            if (link.indexOf(youkuFlag) == 0) {
			                youkuId = link.split('.html?')[0];
			                youkuId = youkuId.split(youkuFlag)[1];
			            }
			            if (youkuId) {
			                let str = '<iframe height=300 width=510 src="https://player.youku.com/embed/' + youkuId + '" frameborder=0 "allowfullscreen"></iframe>';
			                appendPlayer(str, links[i]);
			            }

			            //https://music.163.com/#/song?id=543541094
			            //https://music.163.com/m/song?id=32785700&isofficial=1&playlistid=3136952023
			            let music163Flag1 = 'https://music.163.com/#/song?id=';
			            let music163Flag2 = 'https://music.163.com/m/song?id=';
			            let m163Id = '';
			            if (link.indexOf(music163Flag1) == 0) {
			                m163Id = link.split(music163Flag1)[1];
			                m163Id = m163Id.split('&')[0];
			            }
			            if (link.indexOf(music163Flag2) == 0) {
			                m163Id = link.split(music163Flag2)[1];
			                m163Id = m163Id.split('&')[0];
			            }
			            if (m163Id) {
			                let str = '<iframe frameborder="no" border="0" marginwidth="0" marginheight="0" width=300 height=105 src="//music.163.com/outchain/player?type=2&id=' + m163Id + '&auto=0&height=105"></iframe>';
			                appendPlayer(str, links[i]);
			            }
			        }

			        function appendPlayer(str, target) {
				        let node = document.createElement('div');
				        node.innerHTML = str;
				        console.log('appendPlayer', str, target, target.parentNode);
				        target.parentNode.insertBefore(node, target);
				    }
			    }
			}
		});
	}
})();