sleep:9000
eval:(function(){function find(root,nm){if(!root)return null;var q=[root];while(q.length){var n=q.shift();if(n.name===nm)return n;for(var i=0;i<n.children.length;i++)q.push(n.children[i]);}return null;}var cv=cc.director.getScene().getChildByName('Canvas');var sp=find(cv,'StartPage');var c=sp?sp.getComponent('StartPage'):null;if(!c)return 'no comp';try{c.onTap();return 'onTap direct: entered='+c.entered;}catch(e){return 'EXC:'+e.message+' stack='+(e.stack||'').split('\\n')[1];}})()
sleep:2500
eval:(function(){return 'scene='+cc.director.getScene().name;})()
