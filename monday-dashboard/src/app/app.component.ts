import { CommonModule } from '@angular/common';
import { Component, inject, ViewChild } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { MondayApiService } from './monday-api.service';
import { forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

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
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'monday-dashboard';
  selectedPerson: string = '';

  private itemService = inject(MondayApiService);
  //Prepare Data Table
  displayedColumns: string[] = ['boardName', 'taskName', 'status', 'person'];
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
  this.dataSource.filterPredicate = (data: any, filter: string) => {
    const filterObj = JSON.parse(filter);
    return Object.keys(filterObj).every((key) => {
      return filterObj[key] === '' || data[key] === filterObj[key];
    });
  };

  const currentFilter = this.dataSource.filter ? JSON.parse(this.dataSource.filter) : {};
  currentFilter[column] = value;
  this.dataSource.filter = JSON.stringify(currentFilter);
  if (column === 'person') {
    this.selectedPerson = value;
  }
}

  //Create data objects
  workspaces: any[] = [];
  boards: any[] = [];
  tasks: any[] = [];

  uniqueBoardNames: any[] = [];
  uniqueTaskNames: any[] = [];
  uniqueStatuses: any[] = [];
  uniquePersons: any[] = [];

  constructor() {
    this.itemService.getWorkspaces().subscribe((workspaces: any[]) => {
      
      // Filter workspaces to only include those starting with "ACTIVE"
      const activeWorkspaces = workspaces.filter((workspace: any) =>
        workspace.name.startsWith('ACTIVE')
      );
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
        
        // Extract board IDs
        const boardIds = this.boards.map((board: any) => board.id);

        // Fetch tasks for each board ID
        const taskRequests = boardIds.map((id: string) =>
          this.itemService.getTasksByBoardIds([id])
        );

        // Consolidate all task results into one list
        // Consolidate all task results into one list
        forkJoin(taskRequests).subscribe((taskResults: any[]) => {
          const allTasks = taskResults.flat(); // Flatten the array of arrays into a single list

          // Group tasks by board and structure the result
          // Add the board name to each task
          this.tasks = allTasks.map((task: any) => {
            const board = this.boards.find((b: any) => b.id === task.boardId);
            return {
              ...task,
              boardName: board ? board.name : null, // Attach the board name
            };
          });
          
          this.dataSource.data = this.tasks;
          // Populate unique values for dropdowns
          this.uniqueBoardNames = [...new Set(this.tasks.map((task) => task.boardName))].sort((a, b) => (a > b) ? 1 : -1);
          this.uniqueTaskNames = [...new Set(this.tasks.map((task) => task.taskName))];
          this.uniqueStatuses = [...new Set(this.tasks.map((task) => task.status))];
          this.uniquePersons = [...new Set(this.tasks.map((task) => task.person))].sort((a, b) => (a > b) ? 1 : -1);;

          console.log(this.boards);

          this.dataSource.sort = this.sort;
          this.dataSource.paginator = this.paginator;
        });
        

        
        
      });
    });
  }
}
