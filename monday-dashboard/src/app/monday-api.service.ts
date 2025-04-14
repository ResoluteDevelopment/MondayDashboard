import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { from, Observable } from 'rxjs';
import { concatMap, map, reduce } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MondayApiService {
  private PATH = "";
  private HOST = "https://api.monday.com/v2/";
  private fullUrl = this.HOST + this.PATH;

  private apiToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjM5MDQzMjU4OSwiYWFpIjoxMSwidWlkIjo2MTc1NTg0NSwiaWFkIjoiMjAyNC0wNy0yOVQyMTozNjozNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjM3OTc4MzIsInJnbiI6InVzZTEifQ.u62SRK3B6vt3ody_dPk-0QFKXXCEHDRuZb-R4CFZ_2M';

  constructor(private apollo: Apollo) {
    
   }

  getWorkspaces(): Observable<any> {
    return this.apollo
      .watchQuery({
        query: gql`
          query {
            workspaces(limit: 1000){
              id
              name
            }
          }
        `,
        context: {
          uri: this.fullUrl,
        },
      })
      .valueChanges.pipe(map((result: any) => result.data.workspaces));
  }

  getBoardsByWorkspaceIds(workspaceIds: string[]): Observable<any> {
    return this.apollo
      .query({
        query: gql`
          query {
            boards (workspace_ids: ["${workspaceIds.join('", "')}"]) {
              id
              name
            }
          }
        `,
        context: {
          uri: this.fullUrl,
        },
      })
      .pipe(map((result: any) => {
        // Filter boards to only include those with "Tasks" in the name
        return result.data.boards.filter(
          (board: any) =>
            board.name.includes("Tasks") && !board.name.toLowerCase().includes("subitems")
        )
        .map((board: any) => ({
          ...board,
          name: board.name.replace(/ Tasks$/i, ''), // Trim " Tasks" from the end of the name
          url: `https://resolutecommercial-company.monday.com/boards/${board.id}` // Add URL property
        }));
      }));
  } 

  getTasksByBoardIds(boardIds: string[]): Observable<any> {

    // Helper function to create a query for a specific status
    const createQuery = (status: string) =>
      this.apollo.query({
        query: gql`
          query {
            boards (ids: ["${boardIds.join('", "')}"]) {
              items_page (limit: 100, query_params: {rules: [{column_id: "status", compare_value: ["${status}"], operator:contains_terms}]}) {
                cursor
                items {
                  id 
                  name 
                  column_values {
                    id
                    text
                    value
                  }
                }
              }
            }
          }
        `,
        context: {
          uri: this.fullUrl,
        },
      });

      // Create an array of queries for the statuses
      const statuses = ['Working on it', 'This Week'];
      const queries = statuses.map((status) => createQuery(status));

      // Process the queries sequentially using concatMap
      return from(queries).pipe(
        concatMap((query) => query), // Execute each query sequentially
        map((result: any) => {
          // Flatten and process the results
          return result.data.boards.flatMap((board: any) =>
            board.items_page.items.flatMap((item: any) => {
              const persons = (item.column_values.find((col: any) => col.id === 'person')?.text || '').split(',').map((p: string) => p.trim());
              const status = item.column_values.find((col: any) => col.id === 'status')?.text || '';
              return persons.map((person: string) => ({
                boardId: boardIds[0], // Use the correct board ID
                id: item.id,
                name: item.name,
                person, // Assign each person to a separate task
                status,
              }));
            })
          );
        }),
        reduce<any[], any[]>((allTasks, currentTasks) => [...allTasks, ...currentTasks], []), // Combine all results into a single array
        map((tasks: any[]) => {
          // Filter out tasks where the person is blank
          return tasks.filter((task: any) => task.person && task.person.trim() !== '');
        })
      );
    }

    getTasksByBoardId(boardId: string): Observable<any> {

      // Helper function to create a query for a specific status
      return this.apollo.query({
          query: gql`
            query {
              boards (ids: ["${boardId}"]) {
                items_page (limit: 100, query_params: {rules: [{column_id: "status", compare_value: ["This Week"], operator:contains_terms}]}) {
                  cursor
                  items {
                    id 
                    name 
                    column_values {
                      id
                      text
                      value
                    }
                  }
                }
              }
            }
          `,
          context: {
            uri: this.fullUrl,
          },
        }).pipe(map((result: any) => {
          return result.data.boards;
        }));
  
      }
}
