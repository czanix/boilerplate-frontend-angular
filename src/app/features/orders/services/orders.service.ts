import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Order, CreateOrderInput } from '../models/order.model';

@Injectable({ providedIn: 'root' })
export class OrdersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/v1/orders';

  list(): Observable<Order[]> {
    return this.http.get<Order[]>(this.baseUrl);
  }

  create(input: CreateOrderInput): Observable<Order> {
    return this.http.post<Order>(this.baseUrl, input);
  }

  cancel(publicId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${publicId}/cancel`, {});
  }
}
