import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MondayApiService } from './monday-api.service';
import { forkJoin, from } from 'rxjs';
import { map, mergeMap, toArray } from 'rxjs/operators';

//Angular Material Table
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginator } from '@angular/material/paginator';
import { MatTableModule } from '@angular/material/table';
import { MatSortModule } from '@angular/material/sort';
import { MatPaginatorModule } from '@angular/material/paginator';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatExpansionModule } from '@angular/material/expansion';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    CommonModule,
    MatTableModule,
    MatSortModule,
    MatSelectModule,
    MatPaginatorModule,
    MatFormFieldModule,
    MatInputModule,
    MatExpansionModule,
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'monday-dashboard';
  selectedPerson: string = '';
  selectedStatuses: string[] = ['Working on it', 'This Week']; // Default status filter

  private itemService = inject(MondayApiService);
  //Prepare Task Data Table
  displayedColumns: string[] = ['boardName', 'taskName', 'dueDate', 'status', 'person'];
  groupedDisplayedColumns: string[] = ['taskName', 'dueDate', 'status', 'person']; // Columns for grouped view (without boardName)
  dataSource = new MatTableDataSource<any>();
  @ViewChild(MatSort) sort!: MatSort;
  @ViewChild(MatPaginator) paginator!: MatPaginator;

ngAfterViewInit() {
  this.dataSource.paginator = this.paginator;
}
// Predefined number of color classes
private colorClasses = 10;

// Map to store assigned colors for each person
private personColorMap: { [key: string]: string } = {};

// Method to assign a color class based on the person's name
getPersonClass(person: string): string {
 
  if (!person) {
    return 'person-color-default'; // Default color for empty or undefined names
  }

  // Check if the person already has an assigned color
  if (!this.personColorMap[person]) {
    const hash = this.hashString(person);
    const colorIndex = hash % this.colorClasses; // Map hash to a color class
    this.personColorMap[person] = `person-color-${colorIndex}`;
  }

  return this.personColorMap[person];
}

// Simple hash function to generate a numeric hash from a string
private hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

applyGlobalFilter(event: Event) {
  const filterValue = (event.target as HTMLInputElement).value;
  this.dataSource.filter = filterValue.trim().toLowerCase();
}

applyColumnFilter(column: string, value: string) {
  const filterPredicate = (data: any, filter: string) => {
    const filterObj = JSON.parse(filter);
    return Object.keys(filterObj).every((key) => {
      if (key === 'status') {
        // Handle multi-select status filtering
        const statusArray = filterObj[key];
        return statusArray.length === 0 || statusArray.includes(data[key]);
      }
      return filterObj[key] === '' || data[key] === filterObj[key];
    });
  };

  this.dataSource.filterPredicate = filterPredicate;

  const currentFilter = this.dataSource.filter ? JSON.parse(this.dataSource.filter) : {};
  currentFilter[column] = value;
  const filterString = JSON.stringify(currentFilter);
  this.dataSource.filter = filterString;

  // Apply the same filter to all grouped data sources
  this.groupedTasks.forEach(group => {
    group.dataSource.filterPredicate = filterPredicate;
    group.dataSource.filter = filterString;
  });

  if (column === 'person') {
    this.selectedPerson = value;
  }
}

applyStatusFilter(statuses: string[]) {
  this.selectedStatuses = statuses;
  const filterPredicate = (data: any, filter: string) => {
    const filterObj = JSON.parse(filter);
    return Object.keys(filterObj).every((key) => {
      if (key === 'status') {
        // Handle multi-select status filtering
        const statusArray = filterObj[key];
        return statusArray.length === 0 || statusArray.includes(data[key]);
      }
      return filterObj[key] === '' || data[key] === filterObj[key];
    });
  };

  this.dataSource.filterPredicate = filterPredicate;

  const currentFilter = this.dataSource.filter ? JSON.parse(this.dataSource.filter) : {};
  currentFilter['status'] = statuses;
  const filterString = JSON.stringify(currentFilter);
  this.dataSource.filter = filterString;

  // Apply the same filter to all grouped data sources
  this.groupedTasks.forEach(group => {
    group.dataSource.filterPredicate = filterPredicate;
    group.dataSource.filter = filterString;
  });
}

  //Create data objects
  workspaces: any[] = [];
  boards: any[] = [];
  tasks: any[] = [];
  groupedTasks: { boardName: string, boardId: string, tasks: any[], dataSource: MatTableDataSource<any> }[] = [];
  boardStatusOptions: { [boardId: string]: { label: string, index: number }[] } = {}; // Store status options per board
  boardStatusColumnId: { [boardId: string]: string } = {}; // Store status column ID per board

  uniqueBoardNames: any[] = [];
  uniqueTaskNames: any[] = [];
  uniqueStatuses: any[] = [];
  uniquePersons: any[] = [];

  // Method to group tasks by board and apply filters
  groupTasksByBoard(tasks: any[]): void {
    const grouped = new Map<string, any[]>();

    tasks.forEach(task => {
      const key = task.boardName || 'Unknown';
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key)!.push(task);
    });

    this.groupedTasks = Array.from(grouped.entries())
      .map(([boardName, tasks]) => ({
        boardName,
        boardId: tasks[0]?.boardId || '',
        tasks,
        dataSource: new MatTableDataSource(tasks)
      }))
      .sort((a, b) => a.boardName.localeCompare(b.boardName));

    // Apply filters to each group's data source
    this.groupedTasks.forEach(group => {
      group.dataSource.filterPredicate = this.dataSource.filterPredicate;
      group.dataSource.filter = this.dataSource.filter;
    });
  }

  // Fetch status options for a board
  fetchBoardStatusOptions(boardId: string): void {
    if (this.boardStatusOptions[boardId]) {
      return; // Already fetched
    }

    this.itemService.getBoardColumns(boardId).subscribe((columns: any[]) => {
      // Find the status column (handle custom column IDs like board 8132367671)
      const statusColumn = columns.find((col: any) =>
        col.id === 'status' || col.id === 'status_mkkqfew0'
      );

      if (statusColumn) {
        this.boardStatusColumnId[boardId] = statusColumn.id;

        // Parse the settings to get status labels
        try {
          const settings = JSON.parse(statusColumn.settings_str);
          if (settings.labels) {
            this.boardStatusOptions[boardId] = Object.entries(settings.labels).map(([index, label]) => ({
              label: label as string,
              index: parseInt(index)
            }));
          }
        } catch (e) {
          console.error('Error parsing status column settings:', e);
        }
      }
    });
  }

  // Update task status in Monday.com
  updateTaskStatus(task: any, newStatus: string): void {
    const boardId = task.boardId;
    const columnId = this.boardStatusColumnId[boardId];

    if (!columnId) {
      console.error('Status column ID not found for board:', boardId);
      return;
    }

    // Find the index for the new status
    const statusOption = this.boardStatusOptions[boardId]?.find(opt => opt.label === newStatus);
    if (!statusOption) {
      console.error('Status option not found:', newStatus);
      return;
    }

    // Call the mutation
    this.itemService.updateItemColumnValue(boardId, task.id, columnId, statusOption.index.toString())
      .subscribe({
        next: (result) => {
          console.log('Status updated successfully:', result);
          // Update the local task object
          task.status = newStatus;
        },
        error: (error) => {
          console.error('Error updating status:', error);
          alert('Failed to update status. Please try again.');
        }
      });
  }

  constructor() {
    this.itemService.getWorkspaces().subscribe((workspaces: any[]) => {
      console.log('All workspaces fetched:', workspaces.map(w => w.name));

      // Filter workspaces to only include those starting with "ACTIVE"
      const activeWorkspaces = workspaces.filter((workspace: any) =>
        workspace.name.startsWith('ACTIVE') || workspace.name.includes('RESOLUTE REAL ESTATE')
      );
      console.log('Filtered active workspaces:', activeWorkspaces.map(w => w.name));
      this.workspaces = activeWorkspaces; // Store the filtered workspaces

      // Extract workspace IDs and wrap them in double quotes
      const workspaceIds = activeWorkspaces.map((workspace: any) => `"${workspace.id}"`);

      // Fetch boards for each workspace ID
      const boardRequests = workspaceIds.map((id: string) =>
        this.itemService.getBoardsByWorkspaceIds([id])
      );

      // Consolidate all board results into one list
      forkJoin(boardRequests).subscribe((results: any[]) => {
        this.boards = results.flat(); // Flatten the array of arrays into a single list
        console.log('Boards fetched after filtering:', this.boards.map(b => ({ id: b.id, name: b.name })));

        // Fetch status options for each board
        this.boards.forEach(board => {
          this.fetchBoardStatusOptions(board.id);
        });

        // Extract board IDs
        const boardIds = this.boards.map((board: any) => board.id);

        // Fetch tasks for each board ID
        const taskRequests = boardIds.map((id: string) =>
          this.itemService.getTasksByBoardIds([id])
        );


        // Consolidate all task results into one list
        from(taskRequests).pipe(
          mergeMap(task$ => task$, 20), // Limit to 3 concurrent requests
          toArray()
        ).subscribe((taskResults: any[]) => {
          const allTasks = taskResults.flat(); // Flatten the array of arrays into a single list

          //Group tasks by board and structure the result
          //Add the board name to each task
          this.tasks = allTasks.map((task: any) => {
            const board = this.boards.find((b: any) => b.id === task.boardId);
            return {
              ...task,
              boardName: task.property ? task.property : board ? board.name : null, // Attach the board name
            };
          });
          
          this.dataSource.data = this.tasks;
          // Populate unique values for dropdowns
          this.uniqueBoardNames = [...new Set(this.tasks.map((task) => task.property ? task.property : task.boardName))].sort((a, b) => (a > b) ? 1 : -1);
          this.uniqueTaskNames = [...new Set(this.tasks.map((task) => task.taskName))];
          this.uniqueStatuses = [...new Set(this.tasks.map((task) => task.status))].sort((a, b) => (a > b) ? 1 : -1);
          this.uniquePersons = [...new Set(this.tasks.map((task) => task.person))].sort((a, b) => (a > b) ? 1 : -1);;

          console.log(this.tasks);

          this.dataSource.sort = this.sort;
          this.dataSource.paginator = this.paginator;

          // Apply default status filter
          this.applyStatusFilter(this.selectedStatuses);

          // Group tasks by board for expansion panels
          this.groupTasksByBoard(this.tasks);
        });
        

        
        
      });
    });
  }
}
