import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { from, Observable } from 'rxjs';
import { mergeMap, map, reduce } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MondayApiService {
  private PATH = "";
  private HOST = "https://api.monday.com/v2/";
  private fullUrl = this.HOST + this.PATH;

  private apiToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjM5MDQzMjU4OSwiYWFpIjoxMSwidWlkIjo2MTc1NTg0NSwiaWFkIjoiMjAyNC0wNy0yOVQyMTozNjozNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjM3OTc4MzIsInJnbiI6InVzZTEifQ.u62SRK3B6vt3ody_dPk-0QFKXXCEHDRuZb-R4CFZ_2M';

  //Limit the number of concurrent requests (e.g. 5 at a time)
  private static readonly MAX_CONCURRENT = 1;

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
        const allBoards = result.data.boards;
        console.log('All boards before filtering:', allBoards.map((b: any) => b.name));

        // Filter boards to include task boards and specific project boards (CCTL, Ryff)
        const filteredBoards = allBoards.filter(
          (board: any) => {
            const name = board.name;
            const hasTaskKeyword = name.includes("Tasks") || name.includes("TO DO LIST");
            const isSpecificProject = name.includes("CCTL") || name.includes("Ryff");
            const isNotSubitems = !name.toLowerCase().includes("subitems");

            return (hasTaskKeyword || isSpecificProject) && isNotSubitems;
          }
        )
        .map((board: any) => ({
          ...board,
          name: board.name.replace(/ Tasks$/i, ''), // Trim " Tasks" from the end of the name
          url: `https://resolutecommercial-company.monday.com/boards/${board.id}` // Add URL property
        }));

        console.log('Boards after name filtering:', filteredBoards.map((b: any) => b.name));
        const excludedBoards = allBoards.filter((b: any) => !filteredBoards.some((fb: any) => fb.id === b.id));
        console.log('Excluded boards:', excludedBoards.map((b: any) => b.name));

        return filteredBoards;
      }));
  } 

  getTasksByBoardIds(boardIds: string[]): Observable<any> {
    var status_col = 'status';
    var person_col = 'person';
    var date_col = 'date';

    if (boardIds[0] === '8132367671') {
      status_col = 'status_mkkqfew0';
      person_col = 'people_mkkqkc3e';
    }

    // Fetch ALL tasks without status filtering
    return this.apollo.query({
      query: gql`
        query {
          boards (ids: ["${boardIds.join('", "')}"]) {
            items_page (limit: 500) {
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
    }).pipe(
      map((result: any) => {
        // Flatten and process the results
        return result.data.boards.flatMap((board: any) =>
          board.items_page.items.flatMap((item: any) => {
            const persons = (item.column_values.find((col: any) => col.id === person_col)?.text || '').split(',').map((p: string) => p.trim());
            const status = item.column_values.find((col: any) => col.id === status_col)?.text || '';
            const dueDate = item.column_values.find((col: any) => col.id === date_col)?.text || '';
            const property = item.column_values.find((col: any) => col.id === 'property_mkkqqnwr')?.text || '';

            return persons.map((person: string) => ({
              boardId: boardIds[0],
              id: item.id,
              name: item.name,
              person,
              status,
              dueDate,
              property,
            }));
          })
        );
      }),
      map((tasks: any[]) => {
        // Filter out tasks where the person is blank
        return tasks.filter((task: any) => task.person && task.person.trim() !== '');
      })
    );
  }

    getTasksByBoardId(boardId: string): Observable<any> {

      // Helper function to create a query for a specific status
      return from([
        this.apollo.query({
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
        })
      )
    ]).pipe(
      mergeMap(obs$ => obs$, MondayApiService.MAX_CONCURRENT), // Execute each query sequentially
    );

      }

  // Get status options for a specific board
  getBoardColumns(boardId: string): Observable<any> {
    return this.apollo.query({
      query: gql`
        query {
          boards (ids: ["${boardId}"]) {
            columns {
              id
              title
              type
              settings_str
            }
          }
        }
      `,
      context: {
        uri: this.fullUrl,
      },
    }).pipe(
      map((result: any) => result.data.boards[0]?.columns || [])
    );
  }

  // Update item column value (for status updates)
  updateItemColumnValue(boardId: string, itemId: string, columnId: string, value: string): Observable<any> {
    return this.apollo.mutate({
      mutation: gql`
        mutation {
          change_simple_column_value (
            board_id: ${boardId},
            item_id: ${itemId},
            column_id: "${columnId}",
            value: "${value}"
          ) {
            id
          }
        }
      `,
      context: {
        uri: this.fullUrl,
      },
    });
  }
}
