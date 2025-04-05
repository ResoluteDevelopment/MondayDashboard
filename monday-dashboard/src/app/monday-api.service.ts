import { Injectable } from '@angular/core';
import { Apollo, gql } from 'apollo-angular';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class MondayApiService {
  private PATH = "";
  // private HOST = "https://eo1xwvev9cigdv8.m.pipedream.net";
  private HOST = "https://api.monday.com/v2/";
  private fullUrl = this.HOST + this.PATH;

  private apiToken = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjM5MDQzMjU4OSwiYWFpIjoxMSwidWlkIjo2MTc1NTg0NSwiaWFkIjoiMjAyNC0wNy0yOVQyMTozNjozNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjM3OTc4MzIsInJnbiI6InVzZTEifQ.u62SRK3B6vt3ody_dPk-0QFKXXCEHDRuZb-R4CFZ_2M';

  constructor(private apollo: Apollo) { }

  getWorkspaces(): Observable<any> {
    return this.apollo
      .watchQuery({
        query: gql`
          query {
            workspaces{
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
        );
      }));
  } 

  getTasksByBoardIds(boardIds: string[]): Observable<any> {
    return this.apollo
      .query({
        query: gql`
          query {
            boards (ids: ["${boardIds.join('", "')}"]) {
              items_page (limit: 100, query_params: {rules: [{column_id: "status", compare_value: ["Working on it"], operator:contains_terms}]}) {
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
      })
      .pipe(
        map((result: any) => {
          // Restructure the items to include the board ID and flatten column_values
          return result.data.boards.flatMap((board: any) =>
            board.items_page.items.map((item: any) => {
              const flattenedColumns = item.column_values.reduce((acc: any, column: any) => {
                acc[column.id] = column.text || column.value; // Use text or value
                return acc;
              }, {});
              return {
                boardId: boardIds[0], // Include the board ID
                id: item.id,
                name: item.name,
                ...flattenedColumns, // Spread the flattened column values
              };
            })
          );
        })
      );
  }
}
