sleep:9000
eval:(function(){window.__md=0;window.__te=0;document.addEventListener('mousedown',function(){window.__md++;},true);document.addEventListener('touchstart',function(){window.__te++;},true);var cv=document.getElementById('GameCanvas')||document.querySelector('canvas');window.__cvm=0;if(cv){cv.addEventListener('mousedown',function(){window.__cvm++;},true);}return 'listeners armed canvasId='+(cv?cv.id:'none');})()
jsclick:(function(){var r=document.querySelector('canvas').getBoundingClientRect();return [r.x+r.width/2, r.y+r.height/2];})()
sleep:400
eval:(function(){function find(root,nm){if(!root)return null;var q=[root];while(q.length){var n=q.shift();if(n.name===nm)return n;for(var i=0;i<n.children.length;i++)q.push(n.children[i]);}return null;}var cv=cc.director.getScene().getChildByName('Canvas');var sp=find(cv,'StartPage');var c=sp?sp.getComponent('StartPage'):null;return 'md='+window.__md+' cvm='+window.__cvm+' te='+window.__te+' spEntered='+(c?c.entered:'-');})()
