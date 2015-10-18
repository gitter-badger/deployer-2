$.ajaxPrefilter(function(options, originalOptions, jqXHR) {
    jqXHR.setRequestHeader('X-CSRF-Token', $('meta[name="token"]').attr('content'));
});

var app = app || {};

toastr.options.closeButton = true;
toastr.options.progressBar = true;
toastr.options.preventDuplicates = true;
toastr.options.closeMethod = 'fadeOut';
toastr.options.closeDuration = 300;
toastr.options.closeEasing = 'swing';
toastr.options.positionClass = 'toast-bottom-right';
toastr.options.timeOut = 5000;
toastr.options.extendedTimeOut = 7000;

(function ($) {

    // Don't need to try and connect to the web socket when not logged in
    if (window.location.href.match(/auth|password/) != null) {
        return;
    }

    var FINISHED     = 0;
    var PENDING      = 1;
    var DEPLOYING    = 2;
    var FAILED       = 3;
    var NOT_DEPLOYED = 4;

    var DEPLOYMENT_COMPLETED = 0;
    var DEPLOYMENT_PENDING   = 1;
    var DEPLOYMENT_DEPLOYING = 2;
    var DEPLOYMENT_FAILED    = 3;
    var DEPLOYMENT_ERRORS    = 4;

    app.project_id = app.project_id || null;

    app.listener = io.connect($('meta[name="socket_url"]').attr('content'));

    app.connection_error = false;

    app.listener.on('connect_error', function(error) {
        if (!app.connection_error) {
            $('#socket_offline').show();
        }

        app.connection_error = true;
    });

    app.listener.on('connect', function() {
        $('#socket_offline').hide();
        app.connection_error = false;
    });

    app.listener.on('reconnect', function() {
        $('#socket_offline').hide();
        app.connection_error = false;
    });


    // Navbar deployment status
    // FIXME: Convert these menus to backbone
    // FIXME: Convert the project and deployments to backbone
    // TODO: Update the timeline
    app.listener.on('deployment:REBELinBLUE\\Deployer\\Events\\ModelChanged', function (data) {
        updateNavBar(data);

        //var project = $('#project_' + data.model.project_id);

        if ($('#timeline').length > 0) {
            updateTimeline();
        }

        var deployment  = $('#deployment_' + data.model.id);

        if (deployment.length > 0) {

            $('td:nth-child(4)', deployment).text(data.model.committer);

            if (data.model.commit_url) {
                $('td:nth-child(5)', deployment).html('<a href="' + data.model.commit_url + '" target="_blank">' + data.model.short_commit + '</a>');
            } else {
                $('td:nth-child(5)', deployment).text(data.model.short_commit);
            }

            var icon_class = 'clock-o';
            var label_class = 'info';
            var label = Lang.deployments.status.pending;
            var done = false;

            data.model.status = parseInt(data.model.status);
            var status = $('td:nth-child(7) span.label', deployment);

            if (data.model.status === DEPLOYMENT_COMPLETED) {
                icon_class = 'check';
                label_class = 'success';
                label = Lang.deployments.status.completed;
                done = true;
            } else if (data.model.status === DEPLOYMENT_DEPLOYING) {
                icon_class = 'spinner fa-pulse';
                label_class = 'warning';
                label = Lang.deployments.status.running;
            } else if (data.model.status === DEPLOYMENT_FAILED) {
                icon_class = 'warning';
                label_class = 'danger';
                label = Lang.deployments.status.failed;
                done = true;
            } else if (data.model.status === DEPLOYMENT_ERRORS) {
                icon_class = 'warning';
                label_class = 'success';
                label = Lang.deployments.status.errors;
                done = true;
            }

            if (done) {
                $('button#deploy_project:disabled').removeAttr('disabled');
            }

            status.attr('class', 'label label-' + label_class)
            $('i', status).attr('class', 'fa fa-' + icon_class);
            $('span', status).text(label);
        } else if ($('#timeline').length === 0) { // Don't show on dashboard
            // FIXME: Also don't show if viewing the deployment, or the project the deployment is for
            if (data.model.status === DEPLOYMENT_COMPLETED) {
                toastr.success(Lang.toast.title.replace(':id', data.model.id) + ' - ' + Lang.toast.completed, data.model.project_name);
            } else if (data.model.status === DEPLOYMENT_FAILED) {
                toastr.error(Lang.toast.title.replace(':id', data.model.id) + ' - ' + Lang.toast.failed, data.model.project_name);
            } else if (data.model.status === DEPLOYMENT_ERRORS) {
                toastr.warning(Lang.toast.title.replace(':id', data.model.id) + ' - ' + Lang.toast.completed_with_errors, data.model.project_name);
            }
        }
    });

    app.listener.on('group:REBELinBLUE\\Deployer\\Events\\ModelChanged', function (data) {
        $('#sidebar_group_' + data.model.id).html(data.model.name);
    });

    app.listener.on('project:REBELinBLUE\\Deployer\\Events\\ModelChanged', function (data) {
        $('#sidebar_project_' + data.model.id).html(data.model.name);

        var project = $('#project_' + data.model.id);

        if (project.length > 0) {

            var icon_class = 'question-circle';
            var label_class = 'primary';
            var label = Lang.projects.status.not_deployed;

            data.model.status = parseInt(data.model.status);
            var status = $('td:nth-child(3) span.label', project);

            if (data.model.status === FINISHED) {
                icon_class = 'check';
                label_class = 'success';
                label = Lang.projects.status.finished;
            } else if (data.model.status === DEPLOYING) {
                icon_class = 'spinner fa-pulse';
                label_class = 'warning';
                label = Lang.projects.status.deploying;
            } else if (data.model.status === FAILED) {
                icon_class = 'warning';
                label_class = 'danger';
                label = Lang.projects.status.failed;
            } else if (data.model.status === PENDING) {
                icon_class = 'clock-o';
                label_class = 'info';
                label = Lang.projects.status.pending;
            }

            $('td:first a', project).text(data.model.name);
            $('td:nth-child(2)', project).text(moment(data.model.last_run).format('Do MMMM YYYY h:mm:ss A'));
            status.attr('class', 'label label-' + label_class)
            $('i', status).attr('class', 'fa fa-' + icon_class);
            $('span', status).text(label);
        }
    });

    app.listener.on('project:REBELinBLUE\\Deployer\\Events\\ModelTrashed', function (data) {
        $('#sidebar_project_' + data.model.id).parent('li').remove();

        if (parseInt(data.model.id) === parseInt(app.project_id)) {
            window.location.href = '/';
        }
    });

    // FIXME: This is cheating
    function updateTimeline() {
        $.ajax({
            type: 'GET',
            url: '/timeline'
        }).success(function (response) {
            $('#timeline').html(response);
        });
    }

    function updateNavBar(data) {
        data.model.time = moment(data.model.started_at).format('h:mm:ss A');
        data.model.url = '/deployment/' + data.model.id;

        $('#deployment_info_' + data.model.id).remove();
        $('#pending_menu, #deploying_menu').show();

        var template = _.template($('#deployment_list_template').html());
        var html = template(data.model);

        if (data.model.status === DEPLOYMENT_PENDING) {
            $('#pending_menu ul.menu').append(html);
        }
        else if (data.model.status === DEPLOYMENT_DEPLOYING) {
            $('#deploying_menu ul.menu').append(html);
        }

        var pending = $('#pending_menu ul.menu li').length;
        var deploying = $('#deploying_menu ul.menu li').length;

        var pending_label = Lang.nav.multi_pending.replace(':count', pending);
        if (pending === 0) {
            $('#pending_menu').hide();
        }
        else if (pending === 1) {
            pending_label = Lang.nav.single_pending;
        }

        var deploying_label = Lang.nav.multi_running.replace(':count', deploying);
        if (deploying === 0) {
            $('#deploying_menu').hide();
        }
        else if (deploying === 1) {
            deploying_label = Lang.nav.single_running;
        }

        $('#deploying_menu span.label-warning').html(deploying);
        $('#deploying_menu .header').text(deploying_label);

        $('#pending_menu span.label-info').html(pending);
        $('#pending_menu .header').text(pending_label);
    }

    $(document).ready(function () {
        if ($('#pending_menu ul.menu li').length > 0) {
            $('#pending_menu').show();
        }

        if ($('#deploying_menu ul.menu li').length > 0) {
            $('#deploying_menu').show();
        }
    });

})(jQuery);
