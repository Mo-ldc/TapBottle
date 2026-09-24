sleep:4200
eval:(function(){function find(root,nm){if(!root)return null;var q=[root];while(q.length){var n=q.shift();if(n.name===nm)return n;for(var i=0;i<n.children.length;i++)q.push(n.children[i]);}return null;}var cv=cc.director.getScene().getChildByName('Canvas');var bl=find(cv,'bootLayer');var bc=bl?bl.getComponent('Boot'):null;if(bc){bc.shown=bc.target=1;}return 'ready';})()
sleep:1200
jsclick:(function(){return [100,100];})()
sleep:250
jsclick:(function(){var r=document.querySelector('canvas').getBoundingClientRect();return [r.x+r.width/2, r.y+r.height/2];})()
sleep:1500
eval:(function(){function find(root,nm){if(!root)return null;var q=[root];while(q.length){var n=q.shift();if(n.name===nm)return n;for(var i=0;i<n.children.length;i++)q.push(n.children[i]);}return null;}var cv=cc.director.getScene().getChildByName('Canvas');var bs=find(cv,'bottles');var holder=bs?bs.getChildByName('bottles'):null;var b=holder.children[0];var B=b.getComponent('Bottle');var art=b.getChildByName('art')||b;var wp=art.getWorldPosition();var f=bs.getComponent('BottleField');var o=[];try{f.tapWorld(wp.x,wp.y);o.push('tapWorld called');}catch(e){o.push('EXC '+e.message);}o.push('idleAfter='+B.idle);var flips=window.__tb.G.data.stats?window.__tb.G.data.stats.flips:'-';o.push('flips='+flips);return o.join(' | ');})()
