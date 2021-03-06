/* gantticc.js */
/* Handles data (storage) and dynamic UI */
/* global var: gantticc, gchart */

var gchart;
var gantticc = gantticc || {};

// constructor
function Project(pid, obj) {
	if (pid === -1) {
		$.extend(this, obj); // object coming from Firebase
	} else if ((typeof pid) === "undefined") {
		this.pid = "";
		this.title = "My Awesome Project";
		this.start = new Date().toISOString();
		this.end = new Date(new Date().getTime() + 1000*3600*24*49).toISOString();
		this.tasks = [];
		this.addDummyTask();
	} else {
		this.pid = pid;
		if (localStorage["project"+this.getPid()] !== null) {
			$.extend(this, JSON.parse(localStorage["project"+this.getPid()]));
		} else {
			throw new UserException("invalid project id");
		}
		this.loadTasks();
	}
}
Project.prototype = {
	getPid: function() {
		if (this.pid == "0") return "";
		return this.pid;
	},
	save: function() {
		var obj = {
				title: this.title,
				start: this.start,
				end: this.end
		};
		if (gantticc.firebaseId) {
			var prjRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId+"/"+this.pid);
			obj.pid = this.pid;
			prjRef.update(obj);
		} else {
			localStorage["project"+this.getPid()] = JSON.stringify(obj);
		}
	},
	delete: function(){
		if (gantticc.firebaseId) {
			var pageRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId+"/"+this.pid);
			pageRef.remove();
		} else {
			localStorage.removeItem("project"+this.getPid());
			localStorage.removeItem("tasks"+this.getPid());
		}
	},
	load: function(){
		if (localStorage["project"+this.getPid()] !== null) {
			$.extend(this, JSON.parse(localStorage["project"+this.getPid()]));
		} else {
			throw new UserException("invalid project id");
		}
	},
	loadTasks: function() {
		this.tasks = JSON.parse(localStorage["tasks"+this.getPid()]);
	},
	saveTasks: function(){
		if (gantticc.firebaseId) {
			var prjRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId+"/"+this.pid);
			prjRef.update({ tasks: this.tasks });
		} else {
			localStorage["tasks"+this.getPid()] = JSON.stringify(this.tasks);
		}
	},
	getTask: function(tid){
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			if (t.tid == tid) return t;
		}
		return null;
	},
	deleteTask: function(tid){
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			if (t.tid == tid) break;
		}
		this.tasks.splice(i, 1);
		this.saveTasks();
	},
	addTask: function(task){
		this.tasks.push(task);
		this.saveTasks();
	},
	addDummyTask: function(){
		var today = new Date();
		var start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
		this.tasks.push({
			tid: "1",
			title: "New Task",
			color: "gray",
			start: start.toISOString(),
			end: new Date(start.getTime() + 1000*3600*24*2).toISOString(),
			row: "1",
			notes: "Random notes"
		});
	},
	getTasksOnDate: function(date){
		var tasks = [];
		var d = date.getTime();
		
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			var start = new Date(t.start).getTime();
			var end = new Date(t.end).getTime();
			if (! (new Date(t.start).dst())) {
				start += 1000*3600;
			}
			if (! (new Date(t.end).dst())) {
				end += 1000*3600;
			}
			if (start <= d && end >= d) {
				tasks.push($.extend(true, {}, t)); // return copy
			} else {
				// Google Chrome handles timezone differently from Firefox/Safari,
				// so as a last resort, compare YYYY-MM-DD
				var startDate = new Date(t.start);
				if (date.getFullYear() == startDate.getFullYear()
					&& date.getMonth() == startDate.getMonth()
					&& date.getDate() == startDate.getDate()
				) {
					tasks.push($.extend(true, {}, t)); // return copy
				}
			}
		}
		return tasks;
	},
	getTasksInWeek: function(w){
		var tasks = [];
		for (var i=0; i<this.tasks.length; i++) {
			var t = this.tasks[i];
			var date = new Date(t.start);
			var wn = date.getWeekNumber(date);
			if (wn == w) {
				tasks.push($.extend(true, {}, t)); // return copy
			}
		}
		return tasks;
	},
	getDataForHeatMap: function(unit){
		var data = [];
		var start = new Date(this.start).getTime();
		var end = new Date(this.end).getTime();
		var incTime = 1000*3600*24;
		if (unit === "week") incTime = incTime * 7; // 7 days a week
		for (var t=start; t<=end; t+=incTime) {
			var tasks;
			var date = new Date(t);
			if (!date.dst()) {
				var tmp = date.getTime();
				date = new Date(tmp + 1000*3600);
			}
			if (unit === "day") {
				tasks = this.getTasksOnDate(date);
			} else {
				tasks = this.getTasksInWeek(date.getWeekNumber(date));
			}
			data.push({ date: t, tasks: tasks });
		}
		return data;
	}
};

gantticc.initUI = function(){
	// allocate space for gchart
	$('#gantt').css('min-height', gantticc.getHeight());
	$('#gmask').css({
		'height': gantticc.getHeight(),
		'top': $('#topbar').height()
	});
	// setup date picker
	$(".datepickr").datepicker();
	$(".datepickr").on('click', function(e){
		$(e.target).datepicker('show');
	});
	$(".datepickr").on('changeDate', function(e){
		$(e.target).datepicker('hide');
	});
	// setup tooltips
	$('a[rel=tooltip]').tooltip();
	$('button[rel=tooltip]').tooltip();
	// setup jump-to-month dropdown
	$('#mtab').on('click', function(){
		var x = $('#mtab').offset().left;
		var y = $('#mtab').offset().top;
		$('#mselects').css({ left: x, top: y+2 });
		$('#mselects').show();
	});
	// setup project info model
	$('#project_info_modal').on('show', function(){
		if (gantticc.project.pid == "0") {
			$('#prj_inmd_dfprj').text('This project is currently the default project.');
		} else {
			$('#prj_inmd_dfprj').html('<button class="btn" onclick="gantticc.setDefaultProject(\''+gantticc.project.pid+'\');">Make this the default project</button>');
		}
		$('#prj_ifmd_ptcnt').text(gantticc.project.tasks.length);
		$('#prj_ifmd_expdata').text(gantticc.exportData("google_cal"));
	});
	// hide jump-to-month dropdown upon outside click
	$(document).bind('mouseup touchstart', function(e){
	    var msel = $('#mselects');
		if (!msel.is(e.target) && msel.has(e.target).length === 0){
			msel.hide();
		}
	});
	// listen for hotkeys
	$(document).on('keydown', function(e){
		if (e.keyCode == 27) {
			// listen for escape
			if ($('#task_form').is(':visible')) task_form_cancel();
			if ($('#mselects').is(':visible')) $('#mselects').hide();
		} else if (e.keyCode == 72) {
			// listen for heatmap hotkey "h"
			if (gantticc.listenKey && !$('#task_form').is(':visible')) project_heatmap();
		} else if (e.keyCode == 68) {
			// switch to day mode "d"
			if (gantticc.listenKey && !$('#task_form').is(':visible')) set_scale("day");
		} else if (e.keyCode == 87) {
			// switch to week mode "d"
			if (gantticc.listenKey && !$('#task_form').is(':visible')) set_scale("week");
		} else if (e.keyCode == 82) {
			// r to resize chart
			if (gantticc.listenKey && gantticc.resized) {
				gchart.destroy();
				gantticc.render();
				gantticc.resized = false;
			}
		}
	});
	// enable handling of keydown event or not
	$('input[type=text]')
	    .bind("focus", function(){ gantticc.listenKey = false; })
	    .bind("blur", function(){ gantticc.listenKey = true; });
	$('textarea')
	    .bind("focus", function(){ gantticc.listenKey = false; })
	    .bind("blur", function(){ gantticc.listenKey = true; });
	// update window resize status
	$(window).on('resize', function(){  
		gantticc.resized = true;
	});
};

gantticc.init = function(){
	gantticc.loaded = false;
	gantticc.authenticated = false;
	gantticc.resized = false;
	gantticc.listenKey = true; // listen/handle key presses
	gantticc.scale = "day";
	gantticc.heatmap = {} // Heat Map overrides
	gantticc.projects = [];
	gantticc.project = null;
	gantticc.maxProjCount = 5; // Max number of projects
	// Predefined colors
	gantticc.colors = ['null', 'gray', 'blue', 'orange'];
	gantticc.colorValues = {
		gray: ["#e5e5e5", "#f2f2f2"],
		blue: ["#bee1ef", "#d4effc"],
		orange: ["#ff944d", "#ffa964"]
	};
	gantticc.firebaseUrl = "https://gantticc.firebaseio.com/";
	gantticc.firebasePasscode = "";
	gantticc.passcodeAttempts = 0;
	gantticc.siteUrl = "http://mmw.cx/g/app";
	
	// Check support for Local Storage
	gantticc.localstorage = 1;
	if ((typeof Storage) !== "undefined") {
		gantticc.localstorage = 1;
	} else {
		// no local storage (TODO: show a nicer alert)
		alert("Local storage not supported by your browser. If you wish to save your data, please save it online.");
		gantticc.localstorage = 0;
	}
	
	// Check if data should be loaded from Firebase
	gantticc.firebaseId = gantticc.getParamFromURL("fbdb");
	if (gantticc.firebaseId) {
		// fetch passcode first
		gantticc.getFirebasePasscode(gantticc.firebaseId);
		// try to read all data from Firebase
		var dbRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId);
		dbRef.once('value', function(snapshot){
			if (snapshot.val() == null) {
				gantticc.firebaseId = "";
				// failed to read from server, load/prepare data from local storage
				gantticc.loadDataFromLocalStorage();
			} else {
				var data = snapshot.val();
				// typecast into Project object
				for (var i=0; i<data.length; i++) {
					var prj = new Project(-1, data[i]);
					if (prj.pid === "0") gantticc.project = prj; // default project
					gantticc.projects.push(prj);
				}
				gantticc.updateSharingStatus();
			}
			gantticc.render();
		});
	} else {
		// load straight from local storage and render
		gantticc.firebaseId = "";
		gantticc.loadDataFromLocalStorage();
		gantticc.render();
	}
};

gantticc.render = function(){
	$('#gantt').empty();
	$('#gmask').show().css('opacity',1);
	gchart = bonsai.run(document.getElementById('gantt'),{
		url: 'js/gchart.min.js?bustcache='+Math.random(),
		width: gantticc.getWidth(),
		height: gantticc.getHeight(),
		code: function(){
			stage.on('message:update_task', function(data){
				if (data.cancel === 'true'){
					ganttClickLock = 0;
					return;
				}
				var task = null;
				// find task by task id
				var i = 0;
				for (i; i < gantticc.tasks.length; i++){
					task = gantticc.tasks[i];
					if (task.tid == data.tid) break;
				}
				if (task == null) return;
				if (data.delete === 'true'){
					gchart.deleteTaskAnim(task.group_asset);
					gantticc.tasks.splice(i, 1);
				} else{
					data.title = data.title;
					task.title_asset.attr('text', data.title);
					task.updateIndicatorIcon(data.notes);
					task.updateTaskColor(data.color);
				}
				ganttClickLock = 0;
			});
			stage.on('message:update_project', function(data){
				if (ganttClickLock > 0) return;
				if ((typeof data.start_date) != 'undefined'){
					var scroll_date = new Date();
					if (data.scroll_date) {
						scroll_date = new Date(data.scroll_date);
					}
					gchart.drawHeader(data.start_date, data.end_date);
					gchart.scrollToDate(scroll_date);
					gchart.updateCurrentUnit();
				}
			});
			stage.on('message:init_tasks', function(data){
				if (ganttClickLock > 0) return;
				stage.sendMessage('mask_stage',{show:1});
				setTimeout(function(){
					gchart.initTasks(data.tasks);
					stage.sendMessage('mask_stage',{});
				}, 300);
			});
			stage.on('message:init_heatmap', function(data){
				if (ganttClickLock > 0) return;
				stage.sendMessage('mask_stage',{show:1});
				setTimeout(function(){
					// preserve current scroll position
					var scrollDate = gchart.getScrollDate();
					// check unit
					if (gchart.unit !== data.unit) {
						gchart.unit = data.unit;
					}
					gchart.drawHeader(data.start_date, data.end_date);
					gchart.updateCurrentUnit(1);
					gchart.initHeatMap({
						min: data.min,
						max: data.max,
						projects: data.data
					});
					gchart.scrollToDate(scrollDate);
					// update jump to month button
					stage.sendMessage('scroll_date', {date: scrollDate});
					stage.sendMessage('mask_stage',{});
				}, 300);
			});
			stage.on('message:scroll_to_date', function(data){
				var date = new Date(data.date);
				gchart.scrollToDate(date, 1);
			});
			stage.on('message:scroll_to_task', function(data){
				// vertically center on the given task
				var task = data.task;
				if (parseInt(task.row)*GANTT_TASK_BLK_HGT > Math.floor(stage.height/2)) {
					var diff = parseInt(task.row)*GANTT_TASK_BLK_HGT - Math.floor(stage.height/2);
					diff = Math.ceil( diff/GANTT_TASK_BLK_HGT ) * GANTT_TASK_BLK_HGT;
					gchart.scrollY(diff);
				} else {
					// scroll to top
					gchart.scrollY(gchart.y);
				}
			});
			stage.on('message:set_swatch', function(data){
				gchart.highlightTaskByColor(data.color, data.status);
			});
			stage.on('message:set_scale', function(data){
				if (ganttClickLock > 0) return;
				stage.sendMessage('mask_stage',{show:1});
				setTimeout(function(){
					var scrollDate = new Date();
					if (gchart.unit === data.unit){
						// jump to today if no change
						gchart.scrollToDate(scrollDate);
					} else {
						// preserve current scroll position
						scrollDate = gchart.getScrollDate();
						gchart.unit = data.unit;
						gchart.drawHeader(data.start_date, data.end_date);
						gchart.updateCurrentUnit(1);
						gchart.scrollToDate(scrollDate, 1);
					}
					// update jump to month button
					stage.sendMessage('scroll_date', {date: scrollDate});
					stage.sendMessage('mask_stage',{});
				}, 300);
			});
			stage.sendMessage('ready',{});
		}
	});

	gchart.on('load', function(data){
		gchart.on('message:ready', function(data){
			if (gantticc.authenticated === false) {
				if ( gantticc.youShallNotPass() === false ) {
					gchart.destroy(); // destroy self
					return;
				}
			}
			var startdate = new Date($('#project_startdate').val()).toISOString();
			var enddate = new Date($('#project_enddate').val()).toISOString();
			var today = new Date();
			var scrollto = $('#mtab').attr('value') ? new Date($('#mtab').attr('value')) : today;
			var todaytasks = gantticc.project.getTasksOnDate( new Date() );
			gchart.sendMessage('update_project',{
				start_date: startdate,
				end_date: enddate,
				scroll_date: scrollto
			});
			gchart.sendMessage('init_tasks',{
				tasks: gantticc.project.tasks
			});
			if (todaytasks.length > 0) {
				gchart.sendMessage('scroll_to_task',{ task: todaytasks[0] });
			}
			// now that everything's ready, show intro if necessary
			if (!gantticc.loaded) {
				gantticc.showIntro();
			}
			gantticc.loaded = true;
		});
		gchart.on('message:edit_task', function(data){
			var task = gantticc.project.getTask(data.tid);
			if (task == null) return;
			// show the title edit form
			$('#title_tid').val(task.tid);
			if (task.title === "New Task") {
				$('#title_txtfield').val("");
				$('#title_txtfield').attr('placeholder', "New Task");
			} else {
				$('#title_txtfield').val(task.title);
				$('#title_txtfield').attr('placeholder', "");
			}
			if (!task.color) task.color = "gray";
			$('#task_color').val(task.color);
			for (var i=0; i<gantticc.colors.length; i++){
				var c = gantticc.colors[i];
				$('#task_color_'+c).removeClass('swatch_sel');
			}
			$('#task_color_'+task.color).addClass('swatch_sel');
			$('#notes_txtfield').val(task.notes);
			var y_pos = data.y+$('#topbar').height();
			if ( !$('#settings').is(":hidden") ) y_pos += $('#settings').height();
			$('#task_form').css({ top: y_pos, left: data.x });
			$('#task_form').show();
		});
		gchart.on('message:update_task', function(data){
			var task = gantticc.project.getTask(data.tid);
			if (task == null) return;
			if (data.start) task.start = data.start;
			if (data.end) task.end = data.end;
			if (data.row) task.row = data.row;
			gantticc.project.saveTasks();
		});
		gchart.on('message:new_task', function(data){
			gantticc.project.addTask(data.task);
		});
		gchart.on('message:scroll_date', function(data){
			var cur = new Date(data.date);
			gantticc.updateCurrentMonthBtn(cur);
		});
		gchart.on('message:update_heatmap', function(data){
			project_heatmap(data.unit);
		});
		gchart.on('message:update_project', function(data){
			var to = new Date($('#mtab').attr('value'));
			project_load(data.pid.toString());
			var start = new Date(gantticc.project.start);
			var end = new Date(gantticc.project.end);
			if (to > end) return;
			if (to < start){
				// jump to first day of project
				to = start;
			}
			gchart_scroll(to);
		});
		gchart.on('message:mask_stage', function(data){
			if (data.show) {
				$('#gmask').show().animate({opacity: 1}, 300);
			} else {
				$('#gmask').animate({opacity: 0}, 300, function(){ $('#gmask').hide(); });
			}
		});
	});
	// apply data into ui
	gantticc.applyCurrentProject();
}

gantticc.getColorValue = function(c){
	if (!c) c = "gray"; // default color
	return gantticc.colorValues[c][0];
};

gantticc.loadDataFromLocalStorage = function(){
	if (gantticc.localstorage == 1) {
		gantticc.loadAllProjects();
		if (gantticc.projects.length > 0) {
			// check if GET parameter specifies a project to use
			var userPid = gantticc.getParamFromURL("project");
			if (!userPid) userPid = "0";
			for (var i=0; i<gantticc.projects.length; i++) {
				var prj = gantticc.projects[i];
				if (userPid === prj.pid) {
					gantticc.project = prj;
				}
			}
		} else {
			var prj = new Project();
			gantticc.project = prj;
			gantticc.projects.push(gantticc.project);
		}
	} else {
		gantticc.project = new Project();
	}
};

gantticc.youShallNotPass = function(submit){
	if (gantticc.passcodeAttempts === -1) return;
	if (submit) {
		var pass = $('#passcode').val();
		if (pass != gantticc.firebasePasscode) {
			$('#passcode').css('border-color', '#b94a48');
			gantticc.passcodeAttempts++;
			if (gantticc.passcodeAttempts > 3) gantticc.passcodeAttempts = -1;
		} else {
			gantticc.authenticated = true;
			$('#project_passcode_modal').modal('hide');
			gantticc.render();
			gantticc.listenKey = true; // enable hostkeys
			if ( $('#passcodermbr').prop('checked') ) {
				// remember logged in status for 10 days
				gantticc.setCookie(gantticc.firebaseId, gantticc.firebasePasscode, 10);
			}
		}
	} else {
		// sanity check
		if (!gantticc.firebasePasscode) {
			gantticc.authenticated = true;
			return true;
		}
		//check if cookie is set and equal to the current passcode
		var cookie = gantticc.getCookie(gantticc.firebaseId);
		if (cookie == gantticc.firebasePasscode) {
			gantticc.authenticated = true;
		} else {
			gantticc.listenKey = false; // disable hotkeys
			$('#project_passcode_modal').modal('show');
			$('#passcode').focus();
		}
		return gantticc.authenticated;
	}
};

gantticc.applyCurrentProject = function(){
	// Update UI
	$('#project_title_txtfield').val(gantticc.project.title);
	$("#project_startdate").datepicker('setValue', new Date(gantticc.project.start));
	$("#project_enddate").datepicker('setValue', new Date(gantticc.project.end));
	project_update(false);
	gantticc.resetSwatch();
	gantticc.resetHeatmap();
};

gantticc.loadAllProjects = function(){
	if (gantticc.localstorage == 0) return;
	for (var i=0; i<gantticc.maxProjCount; i++) {
		try {
			var prj = new Project(i.toString());
			gantticc.projects.push(prj);
		} catch (e) {
			break;
		}
	}
};

gantticc.updateProjectList = function(){
	var list = [];
	list.push("<li><a href=\"#\" onclick=\"project_new();\">Create New Project</a></li>");
	list.push("<li class=\"divider\"></li>");
	for (var i=0; i<gantticc.projects.length; i++) {
		var prj = gantticc.projects[i];
		var str = "<li><a href=\"#\" onclick=\"project_load('"+prj.pid+"');\">";
		if (prj.pid === gantticc.project.pid) {
			str += "<b>"+prj.title+"</b>";
		} else {
			str += prj.title;
		}
		str += "<span><span></a></li>";
		list.push(str);
	}
	$('#project_list').html(list.join(""));
};

gantticc.setCurrentProject = function(pid){
	for (var i=0; i<gantticc.projects.length; i++) {
		var prj = gantticc.projects[i];
		if (prj.pid === pid) {
			gantticc.project = prj;
		}
	}
	if (!gantticc.firebaseId) {
		try {
			// reload data into memory since they may have been modified
			gantticc.project.load();
			gantticc.project.loadTasks();
		} catch (e) {
			gantticc.init();
		}
	}
	gantticc.applyCurrentProject();
};

gantticc.deleteCurrentProject = function(){
	gantticc.project.delete();
	for (var i=0; i<gantticc.projects.length; i++) {
		var prj = gantticc.projects[i];
		if (prj.pid == gantticc.project.pid) break;
	}
	gantticc.projects.splice(i, 1);
	if (gantticc.projects.length == 0) {
		var prj = new Project();
		gantticc.project = prj;
		gantticc.projects.push(gantticc.project);
	} else {
		// use the first available project
		gantticc.project = gantticc.projects[0];
	}
};

gantticc.getLiteralMonth = function(m) {
	var mnames = ["January", "February", "March", "April", "May", "June", "July",
				 "August", "September", "October", "November", "December"];
	return mnames[m];
};

gantticc.updateCurrentMonthBtn = function(date){
	// Update jump to month button
	$('#mtab').text( gantticc.getLiteralMonth(date.getMonth()) );
	$('#mtab').attr('value', date.toISOString());
};

gantticc.updateJumpMonthMenu = function(start_date, end_date){
	// generate a list of months to jump to directly
	if (!start_date) start_date = gantticc.project.start;
	if (!end_date) end_date = gantticc.project.end;
	var months = [];
	var start = new Date(start_date);
	var end = new Date(end_date);
	for (var y=start.getFullYear(); y<=end.getFullYear(); y++){
		if (y != start.getFullYear()){
			months.push("<li class=\"disabled\">"+"<a>"+y+"</a></li>");
		}
		var endMonth = (y == end.getFullYear()) ? end.getMonth() : 11;
		var startMonth = (y == start.getFullYear()) ? start.getMonth() : 0;
		for (var m=startMonth; m <= endMonth; m++){
			var startDay = (months.length > 0) ? 1 : start.getDate();
			var btn = "<li><a href=\"#\" onclick=\"gchart_scroll(new Date("+y+","+m+","+startDay+"))\">";
			btn += gantticc.getLiteralMonth(m)+"</a></li>";
			months.push(btn);
		}
	}
	$('#mselects').html( months.join('') );
};

gantticc.addNewProject = function(){
	if (gantticc.projects.length >= gantticc.maxProjCount) return null;
	gantticc.project.save();
	gantticc.project.saveTasks();
	gantticc.project = new Project();
	gantticc.project.title = "New Project";
	gantticc.project.pid = gantticc.projects.length.toString();
	gantticc.projects.push(gantticc.project);
	$('#project_title_txtfield').focus();
	return true;
};

gantticc.exportData = function(type) {
	if (type === "google_cal") {
		var csv = [];
		csv.push("Subject,Start Date,End Date,Description"); // headers
		for (var i=0; i<gantticc.project.tasks.length; i++) {
			var t = gantticc.project.tasks[i];
			var startDate = t.start.split("T")[0];
			startDate.split("-").join("/");
			var endDate = t.end.split("T")[0];
			endDate.split("-").join("/");
			csv.push(t.title+","+startDate+","+endDate+","+t.notes);
		}
		return csv.join("\n");
	}
	else if (type === "print") {
		// export as agenda
		var html = [];
		var start = new Date(gantticc.project.start).getTime();
		var end = new Date(gantticc.project.end).getTime();
		var incTime = 1000*3600*24;
		for (var t=start; t<=end; t+=incTime) {
			var date = new Date(t);
			var tasks = gantticc.project.getTasksOnDate(date);
			if (tasks.length > 0) {
				html.push("<h4>"+date.toDateString()+"</h4>");
				var list = "<ul>";
				for (var i=0; i<tasks.length; i++) {
					list += '<li><span class="tchbx"></span><span class="ttl">'+tasks[i].title+'</span></li>';
				}
				list += "</ul>";
				html.push(list);
			}
		}
		return html.join("");
	}
	return "";
};

gantticc.getParamFromURL = function(key){
	var str = window.location.search.substr(1);
	var paramArr = str.split("&");
	var params = {};
	for (var i=0; i<paramArr.length; i++) {
		var tmp = paramArr[i].split("=");
		if (tmp[0] === key) return tmp[1];
	}
	return "";
};

gantticc.setDefaultProject = function(pid){
	// switch project with pid 0 with this one
	var newDefault = null,
		oldDefault = null;
	for (var i=0; i<gantticc.projects.length; i++) {
		var prj = gantticc.projects[i];
		if (prj.pid === pid) newDefault = prj;
		if (prj.pid === "0") oldDefault = prj;
	}
	if (!newDefault || !oldDefault) return;
	oldDefault.pid = pid;
	oldDefault.save();
	oldDefault.saveTasks();
	newDefault.pid = "0";
	newDefault.save();
	newDefault.saveTasks();
	$('#prj_inmd_dfprj').text('This project has been set as the default project.');
};

gantticc.resetSwatch = function(){
	// make all colors selected
	for (var i=1; i<gantticc.colors.length; i++) {
		var color = gantticc.colors[i];
		var el = $('.swatch_'+color).next().first();
		el.addClass('swatch_checked');
	}
};

gantticc.resetHeatmap = function(){
	$('#heatmap_status').html('Heat Map').attr('value', '');
};

gantticc.getAllTasksOnDate = function(date){
	var arr = [];
	for (var i=0; i<gantticc.projects.length; i++) {
		$.merge(arr, gantticc.projects[i].getTasksOnDate(date));
	}
	return arr;
};

gantticc.getAllTasksInWeek = function(weekNum){
	var arr = [];
	for (var i=0; i<gantticc.projects.length; i++) {
		$.merge(arr, gantticc.projects[i].getTasksInWeek(weekNum));
	}
	return arr;
};

gantticc.getWidth = function(){
	return $('#controls').width();
};

gantticc.getHeight = function(){
	var height = $(document).height()-$('#topbar').height();
	if ($('#botbar').is(':visible')) height -= $('#botbar').height();
	return height;
};

gantticc.openInNewWind = function(){
	// Note: Chrome will open a tiny new window, will have to reload
	var url = location.protocol+'//'+location.host+location.pathname+'?project='+gantticc.project.pid;
	window.open(url);
};

gantticc.shareToFirebase = function(){
	var shareId = $('#project_share_id').val();
	var dbRef = new Firebase(gantticc.firebaseUrl+shareId);
	dbRef.once('value', function(snapshot){
		if (snapshot.val() == null) {
			dbRef.set(gantticc.projects, function(){
				var shareUrl = gantticc.siteUrl+"?fbdb="+shareId;
				$('#prj_share_link').text(shareUrl).show();
			});
			if ( $('#project_share_passcode').val() ) {
				gantticc.setFirebasePasscode(shareId, $('#project_share_passcode').val());
				$('#project_share_passcode').parent().parent().addClass("success");
			}
			$('#project_share_id').parent().parent().removeClass('error').addClass("success");
		} else {
			$('#project_share_id').parent().parent().addClass('error');
			$('#prj_sharefrm_output').html('That sharing ID has been used, pick another one.');
		}
	});
};

gantticc.removeFromFirebase = function(){
	if (gantticc.firebaseId) {
		var dbRef = new Firebase(gantticc.firebaseUrl+gantticc.firebaseId);
		dbRef.remove();
		if (gantticc.firebasePasscode) {
			// remove the passcode
			var dbRef = new Firebase(gantticc.firebaseUrl+"projects/"+gantticc.firebaseId);
			dbRef.remove();
		}
		gantticc.firebaseId = "";
		gantticc.save();
		$('#rmfmfbdb').parent().append("<p>This project has been removed from server.</p>");
	}
};

gantticc.setFirebasePasscode = function(shareId, passcode){
	var prjsRef = new Firebase(gantticc.firebaseUrl+"projects");
	var tuple = {};
	tuple[shareId] = passcode;
	prjsRef.update(tuple);
};

gantticc.getFirebasePasscode = function(shareId){
	var prjsRef = new Firebase(gantticc.firebaseUrl+"projects");
	var query = prjsRef.startAt(null, shareId);
	query.once('value', function(snapshot){
		if (snapshot.val() == null) {
			gantticc.firebasePasscode = "";
		} else {
			var data = snapshot.val();
			gantticc.firebasePasscode = data[shareId];
		}
	});
};

gantticc.updateFirebasePasscode = function(){
	if (!gantticc.authenticated) {
		return; //silently fail
	}
	gantticc.setFirebasePasscode(gantticc.firebaseId, $('#pspasscd').val());
	$('#pspasscd').parent().append('<span id="pspasscdok" class="help-inline">Passcode updated.</span>');
	setTimeout(function(){
		$('#pspasscdok').remove();
	}, 2000);
};

gantticc.updateSharingStatus = function(){
	if (gantticc.firebaseId) {
		var shareUrl = gantticc.siteUrl+"?fbdb="+gantticc.firebaseId;
		var html = '<p>This gantticc is currently shared at: <code><a href="'+shareUrl+'">'+shareUrl+'</a></code></p>';
		html += '<form class="form-inline">';
		html += '<label for="pspasscd">Passcode: </label>\n';
		html += '<input type="password" class="input input-small" name="pspasscd" id="pspasscd" value="';
		if (gantticc.firebasePasscode) {
			for (var i=0; i<gantticc.firebasePasscode.length; i++) html += "*";
		}
		html += '" size="4" />\n';
		html += '<button class="btn" onclick="gantticc.updateFirebasePasscode();return false;">Update</button>';
		html += '</form>';
		html += '<p>To disable sharing, you need to delete data completely from server. But don\'t worry, you still have a local copy of your data.</p>';
		html += '<button id="rmfmfbdb" class="btn btn-danger" onclick="gantticc.removeFromFirebase();">Delete data from server</button>';
		$('#project_share_modal_body').html(html);
	}
};

gantticc.save = function(){
	if (gantticc.localstorage == 0) return;
	for (var i=0; i<gantticc.projects.length; i++) {
		gantticc.projects[i].save();
		gantticc.projects[i].saveTasks();
	}
};

gantticc.showIntro = function(){
	if ( gantticc.getCookie("firsttime").length < 1 ) {
		// just show help modal
		$('#gantticc_help_modal').modal('show');
	}
	gantticc.setCookie("firsttime", "no", 10);
};

gantticc.setCookie = function(key, value, numDays){
	var expiry = new Date();
	expiry.setDate(expiry.getDate() + numDays);
	var cookie = escape(value) + ( (expiry==null) ? "" : "; expires="+expiry.toUTCString() );
	document.cookie = key + "=" + cookie;
};

gantticc.getCookie = function(key){
	var i, x, y, allCookies = document.cookie.split(";");
	for (i=0; i<allCookies.length; i++) {
		x = allCookies[i].substr(0,allCookies[i].indexOf("="));
		y = allCookies[i].substr(allCookies[i].indexOf("=")+1);
		x = x.replace(/^\s+|\s+$/g,"");
		if (x == key) return unescape(y);
	}
	return "";
};

gantticc.print = function(){
	$('#printwrap').html( gantticc.exportData("print") );
	window.print();
};

Date.prototype.getWeekNumber = function(d) {
	/* For a given date, get the ISO week number
	* Based on information at:
	*    http://www.merlyn.demon.co.uk/weekcalc.htm#WNR
	*/
	// Copy date so don't modify original
	d = new Date(d);
	d.setHours(0,0,0);
	// Set to nearest Thursday: current date + 4 - current day number
	// Make Sunday's day number 7
	d.setDate(d.getDate() + 4 - (d.getDay()||7));
	// Get first day of year
	var yearStart = new Date(d.getFullYear(),0,1);
	// Calculate full weeks to nearest Thursday
	var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
	return weekNo;
};
Date.prototype.stdTimezoneOffset = function() {
    var jan = new Date(this.getFullYear(), 0, 1);
    var jul = new Date(this.getFullYear(), 6, 1);
    return Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
}
Date.prototype.dst = function() {
    return this.getTimezoneOffset() < this.stdTimezoneOffset();
}