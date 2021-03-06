import Promise from 'bluebird'
import  * as request from 'superagent'

export function clientListAndProjectP(partnerId){

    console.log("here 3")
    var clientList = null;
    var promise1 = new Promise(function(resolve,reject){
        request.get('http://localhost:8000/api/client_list/24')
        .end(function(err , res){
            if(err){
                reject(err);
            }else{
                clientList = res.body;
                resolve();
            }
        })
    })

    var projects = null;
    var projectStagesByProjectId = null
    var projectTasksByProjectId = null
    var projectSubTasksByProjectId = null
    var projectDeviceCount = null;
    var promise2 = new Promise(function(resolve , reject){
        request.get('http://localhost:8000/api/project_list/24')
        .end(function(err , res){
            if(err){
                reject(err);
            }else{
                projects = res.body.projectList;
                projectStagesByProjectId = res.body.projectStageData
                projectTasksByProjectId = res.body.projectTasks
                projectSubTasksByProjectId = res.body.projectSubtasks
                projectDeviceCount = res.body.projectDeviceCount
                resolve();
            }
        })
    })
    var serviceStageInfoMap = {};

    var promise3 = new Promise(function(resolve , reject){
        request.get('http://localhost:8000/api/service_stage_list')
        .end(function(err , res){
            if(err){
                reject(err);
            }else{
                var serviceStages = res.body
                //console.log(res.body)
                serviceStages.forEach(function(serviceStage){
                    serviceStageInfoMap[serviceStage.id] = serviceStage;
                })
                resolve();
            }
        })
    })

    var clientIdToProjectMap = {}
    var clientData = {};
    return Promise.all([promise1 , promise2 , promise3])
    .then(function(){
        clientList.forEach(function(client){
            clientIdToProjectMap[client.id] = [];
            clientData[ client.name ] = client;
        })

        var tasksByStageId = addSubtasksToTask(projectTasksByProjectId , projectSubTasksByProjectId);
        addTasksToProjectStage(projectStagesByProjectId , tasksByStageId);
        addProjectLevelInfoToProjectStage(projectStagesByProjectId , serviceStageInfoMap);
        //add all the projects in their respective buckets
        projects.forEach(function(project){
            if(clientIdToProjectMap[project.client] == null){
                throw new Error("client id missing --"+project.client);
            }
            if(projectDeviceCount[project.id]){
                project.skuDeviceCount = projectDeviceCount[project.id];
            }else{
                project.skuDeviceCount = 0;
            }
            project.stages = projectStagesByProjectId[project.id]

            clientIdToProjectMap[project.client].push(project);
        })
        return {
            clientIdToProjectMap : clientIdToProjectMap,
            clientData : clientData
        }
    })

}

function addProjectLevelInfoToProjectStage(projectStagesByProjectId , serviceStageInfoMap){

    Object.keys(projectStagesByProjectId).forEach(function(projectId){
        var projectStages = projectStagesByProjectId[projectId];

        projectStages.forEach(function(projectStage){
            var serviceStage = serviceStageInfoMap[projectStage.service_stage];
            if(serviceStage){
                projectStage.isProjectLevel = serviceStage.project_level;
            }else{
                projectStage.isProjectLevel = true
            }
        })
    })


}

function addTasksToProjectStage(projectStagesByProjectId , tasksByStageId ){
    Object.keys(projectStagesByProjectId).forEach(function(projectId){
        var stages = projectStagesByProjectId[projectId];
        stages.forEach(function(stage){
            if( tasksByStageId[stage.id] ){
                stage.tasks = tasksByStageId[stage.id];
            }else{
                stage.tasks = []
            }
        })
    })
}

function addSubtasksToTask(tasksByProjectId , subTasksByProjectId ){
    // flatten the subtasks and index on basis of task id
    var subtasksByTaskId = {};
    Object.keys(subTasksByProjectId).forEach(function(projectId){
        var subtaskArray = subTasksByProjectId[projectId];
        subtaskArray.forEach(function(subtask){
            if( subtasksByTaskId[subtask.project_task] == null ){
                subtasksByTaskId[subtask.project_task] = []
            }
            subtasksByTaskId[subtask.project_task].push(subtask);
        })
    })

    // flatten tasks into map index on stageId
    var tasksByStageId = {};
    Object.keys(tasksByProjectId).forEach(function(projectId){
        var taskArray = tasksByProjectId[projectId];
        taskArray.forEach(function(task){
            if( tasksByStageId[task.project_stage] == null ){
                tasksByStageId[task.project_stage] = [];
            }

            // add the subtasks to every task
            if(subtasksByTaskId[task.id]){
                task.subTasks = subtasksByTaskId[task.id];
            }else{
                task.subTasks = [];
            }

            tasksByStageId[task.project_stage].push(task);
        })
    })

    return tasksByStageId;
}