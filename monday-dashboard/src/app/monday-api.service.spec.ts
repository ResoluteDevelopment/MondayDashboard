import { TestBed } from '@angular/core/testing';

import { MondayApiService } from './monday-api.service';

describe('MondayApiService', () => {
  let service: MondayApiService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MondayApiService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
