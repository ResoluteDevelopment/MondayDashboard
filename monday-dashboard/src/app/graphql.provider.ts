import { ApplicationConfig, inject } from '@angular/core';
import { ApolloClientOptions, InMemoryCache } from '@apollo/client/core';
import { Apollo, APOLLO_OPTIONS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';

const uri = 'https://eo1xwvev9cigdv8.m.pipedream.net'; // <-- add the URL of the GraphQL server here
export function apolloOptionsFactory(): ApolloClientOptions<any> {
  const httpLink = inject(HttpLink);
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjM5MDQzMjU4OSwiYWFpIjoxMSwidWlkIjo2MTc1NTg0NSwiaWFkIjoiMjAyNC0wNy0yOVQyMTozNjozNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjM3OTc4MzIsInJnbiI6InVzZTEifQ.u62SRK3B6vt3ody_dPk-0QFKXXCEHDRuZb-R4CFZ_2M';
  return {
    headers: {
      Authorization: `${token}`,
    },
    link: httpLink.create({ uri }),
    cache: new InMemoryCache(),
  };
}

export const graphqlProvider: ApplicationConfig['providers'] = [
  Apollo,
  {
    provide: APOLLO_OPTIONS,
    useFactory: apolloOptionsFactory,
  },
];