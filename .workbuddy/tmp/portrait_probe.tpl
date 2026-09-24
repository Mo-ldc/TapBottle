eval:JSON.stringify({scene:cc.director.getScene().name,vis:cc.view.getVisibleSize(),innerW:window.innerWidth,innerH:window.innerHeight})
sleep:4000
eval:JSON.stringify({scene:cc.director.getScene().name,vis:cc.view.getVisibleSize(),vo:cc.view.getVisibleOrigin()})
sleep:4000
eval:(function(){var s=cc.director.getScene();function find(n,name){if(n.name===name)return n;for(var i=0;i<n.children.length;i++){var r=find(n.children[i],name);if(r)return r;}return null;}var cv=find(s,'Canvas');var gr=find(s,'GameRoot');var u=find(s,'uiRoot');var b=window.__tb&&__tb.field&&__tb.field.I&&__tb.field.I.bottles&&__tb.field.I.bottles[0];return JSON.stringify({canvas:cv?{pos:cv.position,w:cv.getComponent('cc.UITransform').width,h:cv.getComponent('cc.UITransform').height}:null,gameRoot:gr?{pos:gr.position,scale:gr.scale.x}:null,uiRoot:u?{pos:u.position,w:u.getComponent('cc.UITransform').width,n:u.children.length,active:u.children.map(function(c){return c.name+':'+c.active+':'+Math.round(c.worldPosition.x)+','+Math.round(c.worldPosition.y)})}:null,bottle:b?{wx:Math.round(b.node.worldPosition.x),wy:Math.round(b.node.worldPosition.y)}:null})})()
shot:
