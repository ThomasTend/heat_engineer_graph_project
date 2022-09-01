// Only including the code I wrote here; this won't run by itself.

    /* Compute function */
    function updatePipeNetworkRun () {
      apiService.get('surveys', {
        _id: $routeParams.id
      }).then(function (survey) {
        /*
           We view the network as a set of nodes and edges.
           The nodes are the rooms, the tees, the radiators, the cylinder and the boiler.
           The edges are the pipes that connect the nodes.
        */

        console.log($scope.survey);

        var numberOfTees = 0;

        if($scope.survey.surveys.hasOwnProperty("tees") == true) {
          numberOfTees = $scope.survey.surveys.tees.length;
        }

        var numberOfRooms = $scope.survey.surveys.rooms.length;

        // Get sums of radiator MFRs and store them for each room.

        var numbers = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];

        for(var i = 0; i < numberOfRooms; i++) {
          $scope.survey.surveys.rooms[i].massFlowSubTotal = $scope.survey.surveys.rooms[i].pipe.massFlowRate;
          if($scope.survey.surveys.rooms[i].hasRads == true) {
            var numberOfRadiators = Object.keys($scope.survey.surveys.rooms[i].radiators).length;
            var tmpMFR = 0;
            for(var j = 0; j < numberOfRadiators; j++) {
              if($scope.survey.surveys.rooms[i].radiators[numbers[j]] != null) {
                tmpMFR += $scope.survey.surveys.rooms[i].radiators[numbers[j]].massFlowRate;
                $scope.survey.surveys.rooms[i].radiators[numbers[j]].massFlowSubTotal = $scope.survey.surveys.rooms[i].radiators[numbers[j]].massFlowRate;
              }
            }
            $scope.survey.surveys.rooms[i].massFlowSubTotal += tmpMFR;
          }
        }

        /*
           Compute shortest routes from the boiler to the leaves of the tree,
           using Dijkstra's algorithm.
           The leaves can only be rooms, radiators or the cylinder.
        */

        // Loop through tees, rooms and radiators to populate the sets of nodes and edges.

        var nodes = []; // Node names.
        var nodesID = [];

        for(var i = 0; i < numberOfRooms; i++) {
          nodes.push($scope.survey.surveys.rooms[i].room_name);
          nodesID.push($scope.survey.surveys.rooms[i].pipeRunData.pipeRunAndOrderId);
          if($scope.survey.surveys.rooms[i].hasRads == true) {
            for(var j = 0; j < Object.keys($scope.survey.surveys.rooms[i].radiators).length; j++) {
              if($scope.survey.surveys.rooms[i].radiators[numbers[j]] != null) {
                nodesID.push($scope.survey.surveys.rooms[i].radiators[numbers[j]].pipeRunAndOrderId);
              }
            }
          }
        }

        if($scope.survey.surveys.hasOwnProperty("tees") == true) {
          for(var i = 0; i < numberOfTees; i++) {
            nodesID.push("Tee "+(i+1).toString());
          }
        }

        console.log("nodesID arrays is ");
        console.log(nodesID);

         /*
         edges[i] is the collection of endpoints of edges leaving node nodes[i].
         It's a dictionary of the form {endpoint1[i]:1, ..., endpointN[i]:1},
         where 1 is the weight of each edge.
         */

         var edgesID = {};

        for(var i = 0; i < nodesID.length; i++) {

          var tmpRoom = -1; // tmp index of node in rooms.
          tmpRoom = isNodeRoom(nodesID[i], $scope.survey.surveys.rooms);
          var tmpTee = -1; // tmp index of node in tees.
          if(numberOfTees > 0) {
            tmpTee = isNodeTee(nodesID[i], numberOfTees);
          }
          if(tmpRoom > -1) { // Node is the room with index tmpRoom.
            // Function to get children of a node.
            if($scope.survey.surveys.rooms[tmpRoom].hasRads == false) {
              edgesID[nodesID[i]] = getChildrenNodesID($scope.survey.surveys.rooms[tmpRoom].pipeRunData.pipeRunAndOrderId, $scope.survey.surveys, false, false, false, -1);
            } else { // hasRads is true.
              edgesID[nodesID[i]] = getChildrenNodesID($scope.survey.surveys.rooms[tmpRoom].pipeRunData.pipeRunAndOrderId, $scope.survey.surveys, false, true, false, -1);
              for(var j = 0; j < Object.keys($scope.survey.surveys.rooms[tmpRoom].radiators).length; j++) {
                if($scope.survey.surveys.rooms[tmpRoom].radiators[numbers[j]] != null) {
                  edgesID[$scope.survey.surveys.rooms[tmpRoom].radiators[numbers[j]].pipeRunAndOrderId] = getChildrenNodesID($scope.survey.surveys.rooms[tmpRoom].room_name, $scope.survey.surveys, false, false, true, j);
                }
              }
            }
          } else { // Node is not a room.
            if(tmpTee > -1) { // Node is the tee with index tmpTee.
              edgesID[nodesID[i]] = getChildrenNodesID("Tee "+(tmpTee+1).toString(), $scope.survey.surveys, true, false, false, -1);
            }
            var radIdx = isNodeRad(nodesID[i], $scope.survey.surveys); // array [room, rad].
            if(radIdx[0]>-1) {
              edgesID[nodesID[i]] = getChildrenNodesID($scope.survey.surveys.rooms[radIdx[0]].room_name, $scope.survey.surveys, false, false, true, radIdx[1]);
            }
          }
        }

        // Create Graph.

        //var mapping = {};
        var mappingID = {};

        for (var i = 0; i < nodesID.length; i++) {
            mappingID[nodesID[i]] = edgesID[nodesID[i]];
        }

        for(var i = 0; i < nodes.length; i++) {
          if(mappingID[nodesID[i]] == undefined){
            mappingID[nodesID[i]] = {};
          }
        }

        console.log("The networkID is");
        console.log(mappingID);

        // Identify leaves.

        var leavesID = [];

        for(var i = 0; i < nodesID.length; i++) {
          for(const key of Object.keys(mappingID[nodesID[i]])) {
            if(isLeaf(key, nodesID, mappingID)) {
              var isAlreadyIncluded = false;
              for(var j = 0; j < leavesID.length; j++) {
                if(leavesID[j] == key) {
                  isAlreadyIncluded = true;
                }
              }
              if(isAlreadyIncluded == false) {
                leavesID.push(key);
              }
            }
          }
        }

        console.log('leavesID array is');
        console.log(leavesID);

        // Finish the MFR computations starting from the leaves

        for(var i = 0; i < numberOfRooms; i++) {
          $scope.survey.surveys.rooms[i].isAlreadyCounted = false;
          if($scope.survey.surveys.rooms[i].hasRads == true) {
            for(var j = 0; j < Object.keys($scope.survey.surveys.rooms[i].radiators).length; j++) {
              if($scope.survey.surveys.rooms[i].radiators[numbers[j]] != null) {
                $scope.survey.surveys.rooms[i].radiators[numbers[j]].isAlreadyCounted = false;
              }
            }
          }
        }

        // Take care of the cases when a room is connected to a radiator in another room,
        // and when a room is connected to another room.
        for(var j = 0; j < leavesID.length; j++) {
          var i = getLeafID(leavesID[j], $scope.survey.surveys);
          var tmp = isNodeRadById($scope.survey.surveys.rooms[i[0]].pipeRunData.predecessorId, $scope.survey.surveys, 0, numberOfRooms);
          if(tmp[0] > -1) { // First predecessor is a radiator.
            if($scope.survey.surveys.rooms[tmp[0]].radiators[numbers[tmp[1]]] != null) {
              $scope.survey.surveys.rooms[tmp[0]].radiators[numbers[tmp[1]]].circuitFeedingMassFlowRate = $scope.survey.surveys.rooms[i[0]].massFlowSubTotal;
            }
            for(var l = tmp[1]; l >= 0; l--) {
              if($scope.survey.surveys.rooms[tmp[0]].radiators[numbers[l]] != null) {
                if(l == tmp[1] || $scope.survey.surveys.rooms[tmp[0]].radiators[numbers[l]].isAlreadyCounted == true) {
                  $scope.survey.surveys.rooms[tmp[0]].radiators[numbers[l]].massFlowSubTotal += $scope.survey.surveys.rooms[i[0]].massFlowSubTotal;
                } else {
                  $scope.survey.surveys.rooms[tmp[0]].radiators[numbers[l]].massFlowSubTotal += $scope.survey.surveys.rooms[tmp[0]].radiators[numbers[l+1]].massFlowSubTotal;
                }
                $scope.survey.surveys.rooms[tmp[0]].radiators[numbers[l]].isAlreadyCounted = true;
                }
              }
              $scope.survey.surveys.rooms[tmp[0]].massFlowSubTotal += $scope.survey.surveys.rooms[i[0]].massFlowSubTotal;
              $scope.survey.surveys.rooms[i[0]].isAlreadyCounted = true;
              var isStillRoomOrRad = true;
              var predID = $scope.survey.surveys.rooms[tmp[0]].pipeRunData.predecessorId;
              var prevIdx = tmp;
              while(isStillRoomOrRad) {
                if($scope.survey.surveys.rooms[prevIdx[0]].pipeRunData.predecessorId != "Heat Source") {
                  var idx = getRoomByID(predID, $scope.survey.surveys.rooms, 0, $scope.survey.surveys.rooms.length);
                  if(idx > -1) { // Predecessor is a room.
                    $scope.survey.surveys.rooms[idx].massFlowSubTotal += $scope.survey.surveys.rooms[prevIdx[0]].massFlowSubTotal;
                    $scope.survey.surveys.rooms[prevIdx[0]].isAlreadyCounted = true;
                    predID = $scope.survey.surveys.rooms[idx].pipeRunData.predecessorId;
                    prevIdx[0] = idx;
                  } else { // Predecessor is not a room.
                    var idxRad = isNodeRadById(predID, $scope.survey.surveys, 0, numberOfRooms);
                    if(idxRad[0] > -1) { // Predecessor is a radiator.
                      $scope.survey.surveys.rooms[idxRad[0]].massFlowSubTotal += $scope.survey.surveys.rooms[prevIdx[0]].massFlowSubTotal;
                      $scope.survey.surveys.rooms[prevIdx[0]].isAlreadyCounted = true;
                      for(var l = idxRad[1]; l >= 0; l--) {
                        if(l==idxRad[1] || $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l]].isAlreadyCounted == true) {
                          $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l]].massFlowSubTotal += $scope.survey.surveys.rooms[prevIdx[0]].massFlowSubTotal;
                        } else {
                          $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l]].massFlowSubTotal += $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l+1]].massFlowSubTotal;
                        }
                        $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l]].isAlreadyCounted = true;
                        }
                        if($scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[idxRad[1]]] != null) {
                          $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[idxRad[1]]].circuitFeedingMassFlowRate = $scope.survey.surveys.rooms[prevIdx[0]].massFlowSubTotal;
                        }
                      predID = $scope.survey.surveys.rooms[idxRad[0]].pipeRunData.predecessorId;
                      prevIdx = idxRad;
                    } else { // Predecessor is neither a room nor a radiator.
                      isStillRoomOrRad = false;
                    }
                  }
                } else {
                  isStillRoomOrRad = false;
                }
              }
            } else { // First predecessor is not a radiator.
              var idxRoom = getRoomByID($scope.survey.surveys.rooms[i[0]].pipeRunData.predecessorId, $scope.survey.surveys.rooms, 0, numberOfRooms);
              if(idxRoom > -1) { // Predecessor is a room.
                $scope.survey.surveys.rooms[idxRoom].massFlowSubTotal += $scope.survey.surveys.rooms[i[0]].massFlowSubTotal;
                $scope.survey.surveys.rooms[i[0]].isAlreadyCounted = true;
                var isStillRoomOrRad = true;
                var predID = $scope.survey.surveys.rooms[idxRoom].pipeRunData.predecessorId;
                var prevIdx = idxRoom;
                while(isStillRoomOrRad) {
                    if($scope.survey.surveys.rooms[prevIdx].pipeRunData.predecessorId != "Heat Source") {
                      var idx = getRoomByID(predID, $scope.survey.surveys.rooms, 0, $scope.survey.surveys.rooms.length);
                      if(idx > -1) { // Predecessor is a room.
                        $scope.survey.surveys.rooms[idx].massFlowSubTotal += $scope.survey.surveys.rooms[prevIdx].massFlowSubTotal;
                        $scope.survey.surveys.rooms[prevIdx].isAlreadyCounted = true;
                        predID = $scope.survey.surveys.rooms[idx].pipeRunData.predecessorId;
                        prevIdx = idx;
                        } else { // Predecessor is not a room.
                          var idxRad = isNodeRadById(predID, $scope.survey.surveys, 0, numberOfRooms);
                          if(idxRad[0] > -1) { // Predecessor is a radiator.
                            if($scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[idxRad[1]]] != null) {
                              $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[idxRad[1]]].circuitFeedingMassFlowRate = $scope.survey.surveys.rooms[prevIdx].massFlowSubTotal;
                            }
                            $scope.survey.surveys.rooms[idxRad[0]].massFlowSubTotal += $scope.survey.surveys.rooms[prevIdx[0]].massFlowSubTotal;
                            $scope.survey.surveys.rooms[prevIdx[0]].isAlreadyCounted = true;
                            for(var l = idxRad[1]; l >= 0; l--) {
                              if(l==idxRad[1]) {
                                $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l]].massFlowSubTotal += $scope.survey.surveys.rooms[prevIdx[0]].massFlowSubTotal;
                              } else {
                                $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l]].massFlowSubTotal += $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l+1]].massFlowSubTotal;
                              }
                              $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[l]].isAlreadyCounted = true;
                              }
                            predID = $scope.survey.surveys.rooms[idxRad[0]].pipeRunData.predecessorId;
                            prevIdx = idxRad[0];
                          } else { // Predecessor is neither a room nor a radiator.
                            isStillRoomOrRad = false;
                          }
                        }
                    } else {
                      isStillRoomOrRad = false;
                  }
                }
              }
            }
          }

        /*
        Compute mass flow rate subtotals for tees.
        The tees need to be in order of depth: the least deep first.
        */

        for(let i = numberOfTees-1; i >= 0; i--) { // $scope.survey.surveys
          // if ID1 and ID2 are tees
          if($scope.survey.surveys.tees[i].pipeRunIds[0].roomRunId.substring(0,3) == "tee" && $scope.survey.surveys.tees[i].pipeRunIds[1].roomRunId.substring(0,3) == "tee"){
            var ID1index = parseInt($scope.survey.surveys.tees[i].pipeRunIds[0].roomRunId.charAt($scope.survey.surveys.tees[i].pipeRunIds[0].roomRunId.length-1))-1;
            var ID2index = parseInt($scope.survey.surveys.tees[i].pipeRunIds[1].roomRunId.charAt($scope.survey.surveys.tees[i].pipeRunIds[1].roomRunId.length-1))-1;
            $scope.survey.surveys.tees[i].massFlowSubTotal = $scope.survey.surveys.tees[ID1index].massFlowSubTotal + $scope.survey.surveys.tees[ID2index].massFlowSubTotal;
          } // if ID1 is not a tee and ID2 is a tee
          else if($scope.survey.surveys.tees[i].pipeRunIds[0].roomRunId.substring(0,3) != "tee" && $scope.survey.surveys.tees[i].pipeRunIds[1].roomRunId.substring(0,3) == "tee") {
            var ID1index = getRoomIndexByName($scope.survey.surveys.rooms, $scope.survey.surveys.tees[i].pipeRunIds[0].roomName);
            var ID2index = parseInt($scope.survey.surveys.tees[i].pipeRunIds[1].roomRunId.charAt($scope.survey.surveys.tees[i].pipeRunIds[1].roomRunId.length-1))-1;
            $scope.survey.surveys.tees[i].massFlowSubTotal = $scope.survey.surveys.rooms[ID1index].massFlowSubTotal + $scope.survey.surveys.tees[ID2index].massFlowSubTotal;
          } // if ID1 is a tee and ID2 is not a tee
          else if($scope.survey.surveys.tees[i].pipeRunIds[0].roomRunId.substring(0,3) == "tee" && $scope.survey.surveys.tees[i].pipeRunIds[1].roomRunId.substring(0,3) != "tee") {
            var ID1index = parseInt($scope.survey.surveys.tees[i].pipeRunIds[0].roomRunId.charAt($scope.survey.surveys.tees[i].pipeRunIds[0].roomRunId.length-1))-1;
            var ID2index = getRoomIndexByName($scope.survey.surveys.rooms, $scope.survey.surveys.tees[i].pipeRunIds[1].roomName);
            $scope.survey.surveys.tees[i].massFlowSubTotal = $scope.survey.surveys.tees[ID1index].massFlowSubTotal + $scope.survey.surveys.rooms[ID2index].massFlowSubTotal;
          } // Neither ID1 nor ID2 is a tee
          else {
            var ID1index = getRoomIndexByName($scope.survey.surveys.rooms, $scope.survey.surveys.tees[i].pipeRunIds[0].roomName);
            var ID2index = getRoomIndexByName($scope.survey.surveys.rooms, $scope.survey.surveys.tees[i].pipeRunIds[1].roomName);
            $scope.survey.surveys.tees[i].massFlowSubTotal = $scope.survey.surveys.rooms[ID1index].massFlowSubTotal + $scope.survey.surveys.rooms[ID2index].massFlowSubTotal;
          }
          // Compute the mass flow rate subtotal for the predecessors of the tees.
          var isTeePredRad = isNodeRadById($scope.survey.surveys.tees[i].preId, $scope.survey.surveys, 0, numberOfRooms);
          if(isTeePredRad[0] > -1) { // Predecessor of tee is a radiator.
            if($scope.survey.surveys.rooms[isTeePredRad[0]].radiators[numbers[isTeePredRad[1]]] != null) {
              $scope.survey.surveys.rooms[isTeePredRad[0]].radiators[numbers[isTeePredRad[1]]].circuitFeedingMassFlowRate = $scope.survey.surveys.tees[i].massFlowSubTotal;
            }
            for(var j = isTeePredRad[1]; j >= 0; j--) {
              if(j == isTeePredRad[1] || $scope.survey.surveys.rooms[isTeePredRad[0]].radiators[numbers[j]].isAlreadyCounted == true) {
                $scope.survey.surveys.rooms[isTeePredRad[0]].radiators[numbers[j]].massFlowSubTotal += $scope.survey.surveys.tees[i].massFlowSubTotal;
              } else {
                $scope.survey.surveys.rooms[isTeePredRad[0]].radiators[numbers[j]].massFlowSubTotal = $scope.survey.surveys.rooms[isTeePredRad[0]].radiators[numbers[j+1]].massFlowSubTotal + $scope.survey.surveys.tees[i].massFlowSubTotal;
                $scope.survey.surveys.rooms[isTeePredRad[0]].radiators[numbers[j]].isAlreadyCounted = true;
              }
            }
            var val = $scope.survey.surveys.tees[i].massFlowSubTotal;
            if($scope.survey.surveys.rooms[isTeePredRad[0]].isAlreadyCounted == false) {
              val += $scope.survey.surveys.rooms[isTeePredRad[0]].massFlowSubTotal;
            }
            $scope.survey.surveys.rooms[isTeePredRad[0]].massFlowSubTotal += $scope.survey.surveys.tees[i].massFlowSubTotal;
            $scope.survey.surveys.rooms[isTeePredRad[0]].isAlreadyCounted = true;
            var predID = $scope.survey.surveys.rooms[isTeePredRad[0]].pipeRunData.predecessorId;
            updateMFRsOfPreds(val, predID, $scope.survey.surveys, i);
          } else {
            var isTeePredRoom = getRoomByID($scope.survey.surveys.tees[i].preId, $scope.survey.surveys.rooms, 0, numberOfRooms);
            if(isTeePredRoom > -1) { // Predecessor of tee is a room.
              var val = $scope.survey.surveys.tees[i].massFlowSubTotal;
              if($scope.survey.surveys.rooms[isTeePredRoom].isAlreadyCounted == false) {
                val += $scope.survey.surveys.rooms[isTeePredRoom].massFlowSubTotal;
              }
              $scope.survey.surveys.rooms[isTeePredRoom].massFlowSubTotal += $scope.survey.surveys.tees[i].massFlowSubTotal;
              $scope.survey.surveys.rooms[isTeePredRoom].isAlreadyCounted = true;
              var predID = $scope.survey.surveys.rooms[isTeePredRoom].pipeRunData.predecessorId;
              updateMFRsOfPreds(val, predID, $scope.survey.surveys, i);
            }
          }
        }

        // Identify the root using the "Heat Source" predecessor ID.

        var root_nameID = "";
        for(var i = 0; i < numberOfRooms; i++) {
          if($scope.survey.surveys.rooms[i].pipeRunData.predecessorId == "Heat Source") {
            root_nameID = $scope.survey.surveys.rooms[i].pipeRunData.pipeRunAndOrderId;
          }
        }
        if(numberOfTees > 0) {
          for(var i = 0; i < numberOfTees; i++) {
            if($scope.survey.surveys.tees[i].preId == 'Heat Source') {
              root_nameID = "Tee " + (i+1).toString();
            }
          }
        }
        console.log('In this case, root_nameID is ');
        console.log(root_nameID);

        var pathsID = dijkstra.pathFinder(mappingID, leavesID, root_nameID);
        console.log('mappingID object is');
        console.log(mappingID);

        // Identify additional pathsID.
        for(var key in Object.keys(pathsID)) {
          if(pathsID[key].optionValue != null) {
            for(var i = 0; i < pathsID[key].optionValue.length; i++) {
              if(i>0) {
                mappingID[pathsID[key].optionValue[i-1]][pathsID[key].optionValue[i]] = 10000; // Temporarily increase weight to remove edge from path.
                var tmpPaths = dijkstra.pathFinder(mappingID, leavesID, root_nameID); // Get additional paths.
                mappingID[pathsID[key].optionValue[i-1]][pathsID[key].optionValue[i]] = 1; // Revert to usual weight 1.
                for(var key2 in Object.keys(tmpPaths)) {
                  if(pathsID[key].id == tmpPaths[key2].id) {
                    var isValNotInPaths = true;
                    if(Array.isArray(tmpPaths[key2].optionValue)) {
                      if(Array.isArray(tmpPaths[key2].optionValue[0])) {
                        for(var k = 0; k < tmpPaths[key2].optionValue.length; k++) {
                          if(areArraysEqual(tmpPaths[key2].optionValue[k], pathsID[key].optionValue)) {
                            isValNotInPaths = false;
                          }
                        }
                      } else {
                          if(areArraysEqual(tmpPaths[key2].optionValue, pathsID[key].optionValue)) {
                            isValNotInPaths = false;
                          }
                      }
                    }
                    if(isValNotInPaths == true) {
                      var tmp = [];
                      tmp.push(pathsID[key].optionValue);
                      if(tmpPaths[key2].optionValue != null) {
                        tmp.push(tmpPaths[key2].optionValue);
                      }
                      pathsID[key2].optionValue = tmp;
                    }
                  }
                }
              }
            }
          }
        }

        console.log('pathsID array is');
        console.log(pathsID);

        /*
         Compute the total pressure loss along the routes identified in the previous step.
         */

        var totPressureAlongPaths = {};
        var counter = 0;
        $scope.indexTableData = {}
        $scope.indexTableDataTotal = [];

        for(key in Object.keys(pathsID)) {
          if(Array.isArray(pathsID[key].optionValue)) {
            if(Array.isArray(pathsID[key].optionValue[0])) {
              var tmpArray = [];
              for(var k = 0; k < pathsID[key].optionValue.length; k++) {
                $scope.indexTableData[counter] = [];
                var tmpTotPres = 0;
                for(var i = 0; i < pathsID[key].optionValue[k].length; i++) {
                  var tmpRad = isNodeRad(pathsID[key].optionValue[k][i], $scope.survey.surveys);
                  var tmpRoom = isNodeRoom(pathsID[key].optionValue[k][i], $scope.survey.surveys.rooms);
                  var tmpTee = isNodeTee(pathsID[key].optionValue[k][i], numberOfTees);
                  if(tmpRad[0] > -1) {
                    if($scope.survey.surveys.rooms[tmpRad[0]].radiators[numbers[tmpRad[1]]] != null) {
                      calculatePipeCalcRad(tmpRad[0], numbers[tmpRad[1]]);
                      tmpTotPres += $scope.survey.surveys.rooms[tmpRad[0]].radiators[numbers[tmpRad[1]]].radsTotalPressureLoss;
                      var tmpObject = {};
                      tmpObject["runId"] = $scope.survey.surveys.rooms[tmpRad[0]].radiators[numbers[tmpRad[1]]].pipeRunAndOrderId;
                      tmpObject["totPressure"] = $scope.survey.surveys.rooms[tmpRad[0]].radiators[numbers[tmpRad[1]]].radsTotalPressureLoss;
                      $scope.indexTableData[counter].push(tmpObject);
                    }
                  } else if(tmpRoom > -1) {
                    calculatePipeCalc(tmpRoom);
                    tmpTotPres += $scope.survey.surveys.rooms[tmpRoom].pipe.totPressureLoss;
                    var tmpObject = {};
                    tmpObject["runId"] = $scope.survey.surveys.rooms[tmpRoom].pipeRunData.pipeRunAndOrderId;
                    tmpObject["totPressure"] = $scope.survey.surveys.rooms[tmpRoom].pipe.totPressureLoss;
                    $scope.indexTableData[counter].push(tmpObject);
                  } else {
                    if(tmpTee > -1) {
                      getTees(tmpTee);
                      tmpTotPres += $scope.survey.surveys.tees[tmpTee].totalPressureLoss;
                      var tmpObject = {};
                      tmpObject["runId"] = "Tee "+(tmpTee+1).toString();
                      tmpObject["totPressure"] = $scope.survey.surveys.tees[tmpTee].totalPressureLoss;
                      $scope.indexTableData[counter].push(tmpObject);
                    }
                  }
                }
                var tmpObj = {};
                tmpObj[pathsID[key].optionValue[k]] = tmpTotPres;
                $scope.indexTableDataTotal.push(tmpTotPres);
                tmpArray.push(tmpObj);
                counter += 1;
              }
              totPressureAlongPaths[pathsID[key].id] = tmpArray;
            } else {
              $scope.indexTableData[counter] = [];
              var tmpArray = [];
              var tmpTotPres = 0;
              for(var i = 0; i < pathsID[key].optionValue.length; i++) {
                var tmpRad = isNodeRad(pathsID[key].optionValue[i], $scope.survey.surveys);
                var tmpRoom = isNodeRoom(pathsID[key].optionValue[i], $scope.survey.surveys.rooms);
                var tmpTee = isNodeTee(pathsID[key].optionValue[i], numberOfTees);
                if(tmpRad[0] > -1) {
                  if($scope.survey.surveys.rooms[tmpRad[0]].radiators[numbers[tmpRad[1]]] != null) {
                    calculatePipeCalcRad(tmpRad[0], numbers[tmpRad[1]]);
                    tmpTotPres += $scope.survey.surveys.rooms[tmpRad[0]].radiators[numbers[tmpRad[1]]].radsTotalPressureLoss;
                    var tmpObject = {};
                    tmpObject["runId"] = $scope.survey.surveys.rooms[tmpRad[0]].radiators[numbers[tmpRad[1]]].pipeRunAndOrderId;
                    tmpObject["totPressure"] = $scope.survey.surveys.rooms[tmpRad[0]].radiators[numbers[tmpRad[1]]].radsTotalPressureLoss;
                    $scope.indexTableData[counter].push(tmpObject);
                  }
                } else if(tmpRoom > -1) {
                  calculatePipeCalc(tmpRoom);
                  tmpTotPres += $scope.survey.surveys.rooms[tmpRoom].pipe.totPressureLoss;
                  var tmpObject = {};
                  tmpObject["runId"] = $scope.survey.surveys.rooms[tmpRoom].pipeRunData.pipeRunAndOrderId;
                  tmpObject["totPressure"] = $scope.survey.surveys.rooms[tmpRoom].pipe.totPressureLoss;
                  $scope.indexTableData[counter].push(tmpObject);
                } else {
                  if(tmpTee > -1) {
                    getTees(tmpTee);
                    tmpTotPres += $scope.survey.surveys.tees[tmpTee].totalPressureLoss;
                    var tmpObject = {};
                    tmpObject["runId"] = "Tee "+(tmpTee+1).toString();
                    tmpObject["totPressure"] = $scope.survey.surveys.tees[tmpTee].totalPressureLoss;
                    $scope.indexTableData[counter].push(tmpObject);
                  }
                }
              }
              counter += 1;
              var tmpObj = {};
              tmpObj[pathsID[key].optionValue] = tmpTotPres;
              $scope.indexTableDataTotal.push(tmpTotPres);
              tmpArray.push(tmpObj);
              totPressureAlongPaths[pathsID[key].id] = tmpArray;
            }
          }
        }

        for(var i = 0; i < $scope.indexTableDataTotal.length; i++) {
          $scope.indexTableDataTotal[i] += $scope.survey.surveys.primaryFlowIndex.totPreLoss;
        }

        console.log('totPressureAlongPaths array is');
        console.log(totPressureAlongPaths);

        console.log("$scope.indexTableData is");
        console.log($scope.indexTableData);

        console.log("$scope.indexTableDataTotal is");
        console.log($scope.indexTableDataTotal);

        // Select the route with the maximum pressure loss.

        var tmpArr = Object.keys(totPressureAlongPaths)

        var maxLeaf = tmpArr[0];
        var maxPathIdx = 0;
        var maxPath = Object.keys(totPressureAlongPaths[maxLeaf][maxPathIdx])[0];

        for(var i = 0; i < tmpArr.length; i++) {
          var tmpArr2 = Object.keys(totPressureAlongPaths[tmpArr[i]]);
          for(var j = 0; j < tmpArr2.length; j++) {
            var tmpArr3 = Object.keys(totPressureAlongPaths[tmpArr[i]][j]);
            for(var k = 0; k < tmpArr3.length; k++) {
              var tmpPath = Object.keys(totPressureAlongPaths[tmpArr[i]][j])[0];
              if(totPressureAlongPaths[tmpArr[i]][j][tmpPath] > totPressureAlongPaths[maxLeaf][maxPathIdx][maxPath]) {
                maxPathIdx = j;
                maxLeaf = tmpArr[i];
                maxPath = Object.keys(totPressureAlongPaths[maxLeaf][maxPathIdx])[0];
              }
            }
          }
        }

        console.log('The path of largest total pressure is ');
        console.log(Object.keys(totPressureAlongPaths[maxLeaf][maxPathIdx])[0]);

        $scope.maxLeafName = {};

        var maxLeafIdx = isNodeRadById(maxLeaf, $scope.survey.surveys, 0, numberOfRooms);
        if(maxLeafIdx[0] > -1) { // Then maxLeaf is a rad.
          $scope.maxLeafName["roomName"] = $scope.survey.surveys.rooms[maxLeafIdx[0]].room_name;
          $scope.maxLeafName["radName"] = $scope.survey.surveys.rooms[maxLeafIdx[0]].radiators[numbers[maxLeafIdx[1]]].type;
        } else {
          var maxLeafIdxRoom = isNodeRoom(maxLeaf, $scope.survey.surveys.rooms);
          if(maxLeafIdxRoom > -1) {
            $scope.maxLeafName["roomName"] = $scope.survey.surveys.rooms[maxLeafIdxRoom].room_name;
            $scope.maxLeafName["radName"] = null;
          }
        }

        console.log("$scope.maxLeafName is ");
        console.log($scope.maxLeafName);

        console.log('Its total pressure loss is')
        console.log(totPressureAlongPaths[maxLeaf][maxPathIdx][maxPath]+ $scope.survey.surveys.primaryFlowIndex.totPreLoss)
        $scope.finalData.icsubTotal = totPressureAlongPaths[maxLeaf][maxPathIdx][maxPath].toFixed(3)

        console.log('The survey object is ');
        console.log($scope.survey);

      });
    }

    // Helper functions.

    // Update MFR subtotals of predecessors of the predecessor of a tee
    function updateMFRsOfPreds(val, predID, surveys, idxTee) {
      var numbers = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
      var isHS = false;
      while(!isHS) {
        var idx = getRoomByID(predID, surveys.rooms, 0, surveys.rooms.length);
        if(idx > -1) {
          if(surveys.rooms[idx].isAlreadyCounted == true) {
            surveys.rooms[idx].massFlowSubTotal += val;
          } else {
            var tmp = surveys.rooms[idx].massFlowSubTotal;
            surveys.rooms[idx].massFlowSubTotal += val;
            val += tmp;
          }
          predID = surveys.rooms[idx].pipeRunData.predecessorId;
        } else {
          if(predID != "Heat Source") {
            var idxRad = isNodeRadById(predID, $scope.survey.surveys, 0, surveys.rooms.length);
            if(idxRad[0] > -1) {
              if(getRoomByID(predID, surveys.rooms, 0, surveys.rooms.length) > -1) {
                if($scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[idxRad[1]]] != null) {
                  $scope.survey.surveys.rooms[idxRad[0]].radiators[numbers[idxRad[1]]].circuitFeedingMassFlowRate = $scope.survey.surveys.tees[idxTee].massFlowSubTotal;
                }
              }
              for(var l = idxRad[1]; l >= 0; l--) {
                if(l == idxRad[1] || surveys.rooms[idxRad[0]].radiators[numbers[l]].isAlreadyCounted == true) {
                  surveys.rooms[idxRad[0]].radiators[numbers[l]].massFlowSubTotal += val;
                } else {
                  surveys.rooms[idxRad[0]].radiators[numbers[l]].massFlowSubTotal = surveys.rooms[idxRad[0]].radiators[numbers[l+1]].massFlowSubTotal + val;
                }
              }
              if(surveys.rooms[idxRad[0]].isAlreadyCounted == true) {
                surveys.rooms[idxRad[0]].massFlowSubTotal += val; // MFRs of rads have already been added up.
              } else {
                var tmp = surveys.rooms[idxRad[0]].massFlowSubTotal;
                surveys.rooms[idxRad[0]].massFlowSubTotal += val; // MFRs of rads have already been added up.
                val += tmp;
              }
              predID = surveys.rooms[idxRad[0]].pipeRunData.predecessorId;
            } else { // Predecessor is neither a radiator nor a room.
              isHS = true;
            }
          } else {
            isHS = true;
          }
        }
      }
    }

    // Check if key is a leaf of the tree, i.e. an endpoint.
    function isLeaf(key, nodes, mapping) {
      for(var i = 0; i < nodes.length; i++) {
        if(nodes[i] == key && Object.keys(mapping[nodes[i]]).length != 0) {
          return false;
        }
      }
      return true;
    }

    // Get room index by roomName
    function getRoomIndexByName(rooms, roomName) { // roomName corresponds to ID1 or ID2 of a tee
      var toRet = 0;
      for(var i = 0; i < rooms.length; i++) {
        if(rooms[i].room_name == roomName) {
          toRet = i;
          break;
        }
      }
      return toRet;
    }

    function getRoomByID(ID, rooms, start, max) {
      for(var i = start; i < max; i++) {
        if(rooms[i].pipeRunData.pipeRunAndOrderId == ID) {
          return i;
        }
      }
      return -1;
    }

    // Is a node a room?
    function isNodeRoom(node, rooms) {
      for(var i = 0; i < rooms.length; i++) {
        if(node == rooms[i].pipeRunData.pipeRunAndOrderId) {
          return i;
        }
      }
      return -1;
    }

    // Is a node a tee?
    function isNodeTee(node, numberOfTees) {
      for(var i = 0; i < numberOfTees; i++) {
        if(node == "Tee "+(i+1).toString()) {
          return i;
        }
      }
      return -1;
    }

    // Is a node a radiator?
    function isNodeRadById(node, surveys, start, max) {
      var numbers = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
      for(var i = start; i < max; i++) {
        if(surveys.rooms[i].hasRads == true) {
          for(var j = 0; j < Object.keys(surveys.rooms[i].radiators).length; j++) {
            if(surveys.rooms[i].radiators[numbers[j]] != null) {
              if(node == surveys.rooms[i].radiators[numbers[j]].pipeRunAndOrderId) {
                return [i,j]; // room, rad.
              }
            }
          }
        }
      }
      return [-1, -1];
    }

    // Get leaf ID
    function getLeafID(leaf, surveys) {
      var toRet = isNodeRad(leaf, surveys);
      if(toRet[0] > -1) {
        return toRet;
      } else {
        var toRet2 = isNodeRoom(leaf, surveys.rooms);
        if(toRet2 > -1) {
          return [toRet2, -1];
        } else {
          return [-1, -1];
        }
      }
    }

    // Is a node a radiator?
    function isNodeRad(node, surveys) {
      var numbers = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
      for(var i = 0; i < surveys.rooms.length; i++) {
        if(surveys.rooms[i].hasRads == true) {
          for(var j = 0; j < Object.keys(surveys.rooms[i].radiators).length; j++) {
            if(surveys.rooms[i].radiators[numbers[j]] != null) {
              if(node == surveys.rooms[i].radiators[numbers[j]].pipeRunAndOrderId) {
                return [i,j]; // room, rad.
              }
            }
          }
        }
      }
      return [-1, -1];
    }

    // Return children IDs of node based on its ID
    function getChildrenNodesID(ID, surveys, isTee, hasRads, isRad, radIndex) {
      var numbers = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
      var toRet = {};
      for(var i = 0; i < surveys.rooms.length; i++) {
        if(ID == surveys.rooms[i].pipeRunData.predecessorId) {
          toRet[surveys.rooms[i].pipeRunData.pipeRunAndOrderId]=1;
        }
      }
      if(surveys.hasOwnProperty("tees") == true) {
        for(var i = 0; i < surveys.tees.length; i++) {
          if(ID == surveys.tees[i].preId) {
            toRet["Tee "+(i+1).toString()]=1;
          }
        }
      }
      if(isTee) {
        var tmpTee = isNodeTee(ID, surveys.tees.length);
        parseInt(surveys.tees[tmpTee].pipeRunIds[0].roomRunId.charAt(surveys.tees[tmpTee].pipeRunIds[0].roomRunId.length-1));
        // Two outputs are tees.
        if((surveys.tees[tmpTee].pipeRunIds[0].roomName == null || surveys.tees[tmpTee].pipeRunIds[0].roomName == "") && (surveys.tees[tmpTee].pipeRunIds[1].roomName == null || surveys.tees[tmpTee].pipeRunIds[1].roomName == "")) {
          toRet["Tee " + parseInt(surveys.tees[tmpTee].pipeRunIds[0].roomRunId.charAt(surveys.tees[tmpTee].pipeRunIds[0].roomRunId.length-1)).toString()] = 1;
          toRet["Tee " + parseInt(surveys.tees[tmpTee].pipeRunIds[1].roomRunId.charAt(surveys.tees[tmpTee].pipeRunIds[1].roomRunId.length-1)).toString()] = 1;
        } else if((surveys.tees[tmpTee].pipeRunIds[0].roomName != null && surveys.tees[tmpTee].pipeRunIds[0].roomName != "") && (surveys.tees[tmpTee].pipeRunIds[1].roomName == null || surveys.tees[tmpTee].pipeRunIds[1].roomName == "")) {
          // Ouput 1 is a room and output 2 is a tee.
          toRet[surveys.tees[tmpTee].pipeRunIds[0].roomRunId] = 1;
          toRet["Tee " + parseInt(surveys.tees[tmpTee].pipeRunIds[1].roomRunId.charAt(surveys.tees[tmpTee].pipeRunIds[1].roomRunId.length-1)).toString()] = 1;
        } else if((surveys.tees[tmpTee].pipeRunIds[0].roomName == null || surveys.tees[tmpTee].pipeRunIds[0].roomName == "") && (surveys.tees[tmpTee].pipeRunIds[1].roomName != null && surveys.tees[tmpTee].pipeRunIds[1].roomName != "")) {
          // Ouput 1 is a tee and output 2 is a room.
          toRet["Tee " + parseInt(surveys.tees[tmpTee].pipeRunIds[0].roomRunId.charAt(surveys.tees[tmpTee].pipeRunIds[0].roomRunId.length-1)).toString()] = 1;
          toRet[surveys.tees[tmpTee].pipeRunIds[1].roomRunId] = 1;
        } else { // Two outputs are rooms
          toRet[surveys.tees[tmpTee].pipeRunIds[0].roomRunId] = 1;
          toRet[surveys.tees[tmpTee].pipeRunIds[1].roomRunId] = 1;
        }
      }
      if(hasRads) {
        var tmpRoom = -1;
        for(var i = 0; i < surveys.rooms.length; i++) {
          if(ID == surveys.rooms[i].pipeRunData.pipeRunAndOrderId) {
            tmpRoom = i;
          }
        }

        for(var i = 0; i < Object.keys(surveys.rooms[tmpRoom].radiators).length; i++) {
          if(surveys.rooms[tmpRoom].radiators[numbers[i]] != null) {
            if(surveys.rooms[tmpRoom].radiators[numbers[i]].predecessorId == surveys.rooms[tmpRoom].pipeRunData.pipeRunAndOrderId) {
              toRet[surveys.rooms[tmpRoom].radiators[numbers[i]].pipeRunAndOrderId]=1;
            }
          }
        }
      }
      if(isRad) {
        var tmpRoom = -1;
        for(var i = 0; i < surveys.rooms.length; i++) {
          if(ID == surveys.rooms[i].room_name) {
            tmpRoom = i;
          }
        }
        var radFullID = "";
        if(tmpRoom > -1) {
          if(surveys.rooms[tmpRoom].radiators[numbers[radIndex]] != null) {
            radFullID = surveys.rooms[tmpRoom].radiators[numbers[radIndex]].pipeRunAndOrderId;
          }
        }
        loop1:
        for(var i = 0; i < surveys.rooms.length; i++) {
          if(radFullID == surveys.rooms[i].pipeRunData.predecessorId) {
            toRet[surveys.rooms[i].pipeRunData.pipeRunAndOrderId] = 1;
            break;
          }
          if(surveys.rooms[i].hasRads) {
            loop2:
            for(var j = 0; j < Object.keys(surveys.rooms[i].radiators).length; j++) {
              if(surveys.rooms[i].radiators[numbers[j]] != null) {
                if(radFullID == surveys.rooms[i].radiators[numbers[j]].predecessorId) {
                  toRet[surveys.rooms[i].radiators[numbers[j]].pipeRunAndOrderId] = 1;
                  break loop1;
                }
              }
            }
          }
        }
        for(var l = 0; l < surveys.tees.length; l++) {
          if(surveys.tees[l].preId == radFullID) {
            toRet["Tee "+(l+1).toString()] = 1;
          }
        }
      }
      return toRet;
    }

    function areArraysEqual(x, y) {
      if(x.length != y.length) {
        return false;
      } else {
        for(var i = 0; i < x.length; i++) {
          if(x[i] != y[i]) {
            return false;
          }
        }
        return true;
      }
    }
