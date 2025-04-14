import { ApplicationConfig, provideZoneChangeDetection, inject } from '@angular/core';
import { provideRouter } from '@angular/router';

import { routes } from './app.routes';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { Apollo, provideApollo } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { ApolloLink, InMemoryCache } from '@apollo/client/core';
import { graphqlProvider } from './graphql.provider';
import { setContext } from '@apollo/client/link/context';

provideApollo(() => {
  const httpLink = inject(HttpLink);
 
  const basic = setContext((operation, context) => ({
    headers: {
      Accept: 'charset=utf-8'
    },
  }));
 
  // Authorization token
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjM5MDQzMjU4OSwiYWFpIjoxMSwidWlkIjo2MTc1NTg0NSwiaWFkIjoiMjAyNC0wNy0yOVQyMTozNjozNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjM3OTc4MzIsInJnbiI6InVzZTEifQ.u62SRK3B6vt3ody_dPk-0QFKXXCEHDRuZb-R4CFZ_2M';

  // Context middleware to add the Authorization header
  const authLink = setContext(() => ({
    headers: {
      Authorization: `${token}`,
    },
  }));
 
  return {
    link: ApolloLink.from([authLink, httpLink.create({ uri: '/graphql' })]),
    cache: new InMemoryCache(),
    // other options ...
  };
});

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    graphqlProvider,
    provideRouter(routes),
    provideClientHydration(withEventReplay()),
    provideHttpClient(),
    provideApollo(() => {
      const httpLink = inject(HttpLink);

      // Reuse the same token and authLink setup
      const authLink = setContext(() => ({
        headers: {
          Authorization: `eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjM5MDQzMjU4OSwiYWFpIjoxMSwidWlkIjo2MTc1NTg0NSwiaWFkIjoiMjAyNC0wNy0yOVQyMTozNjozNC4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6MjM3OTc4MzIsInJnbiI6InVzZTEifQ.u62SRK3B6vt3ody_dPk-0QFKXXCEHDRuZb-R4CFZ_2M`,
        },
      }));

      return {
        link: ApolloLink.from([authLink, httpLink.create({ uri: '/graphql' })]),
        cache: new InMemoryCache({
          dataIdFromObject: o => false
        }),
        fetchPolicy: "no-cache",
      };
    }),
  ],
};
