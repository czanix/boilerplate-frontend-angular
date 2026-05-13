# Czanix Boilerplate — Angular

> Angular com arquitetura modular, standalone components (v17+), Signal-based state e HTTP com interceptors. Estrutura que escala de MVP a produto enterprise sem reescrever.

[![Angular](https://img.shields.io/badge/Angular-DD0031?style=flat&logo=angular&logoColor=white)](https://angular.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8ACC?style=flat&logo=typescript&logoColor=white)](https://typescriptlang.org)
[![RxJS](https://img.shields.io/badge/RxJS-B7178C?style=flat&logo=reactivex&logoColor=white)](https://rxjs.dev)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Tech Reference](https://img.shields.io/badge/Czanix-Tech%20Reference-gold)](https://czanix.com/pt/stack)

---

## Estrutura

```
src/app/
├── core/                        # Singleton — carregado uma vez
│   ├── services/
│   │   ├── auth.service.ts
│   │   └── api.service.ts
│   ├── interceptors/
│   │   ├── auth.interceptor.ts  # Injeta token em toda requisição
│   │   └── error.interceptor.ts # Trata 401, 403, 500 globalmente
│   ├── guards/
│   │   └── auth.guard.ts
│   └── models/
│       └── result.model.ts      # Result<T>
│
├── shared/                      # Reutilizável entre features
│   ├── components/
│   │   ├── button/
│   │   └── loading/
│   └── pipes/
│       └── safe-date.pipe.ts
│
└── features/                    # Módulos de funcionalidade
    └── orders/
        ├── orders.routes.ts      # Lazy loading — não carrega até precisar
        ├── components/
        │   ├── order-list/
        │   │   ├── order-list.component.ts
        │   │   └── order-list.component.html
        │   └── order-detail/
        ├── services/
        │   └── order.service.ts
        └── models/
            └── order.model.ts
```

---

## Interceptors — onde você não quer esquecer

```typescript
// core/interceptors/auth.interceptor.ts
// Injeta o token em TODAS as requisições HTTP — sem esquecer em nenhuma chamada
import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.getToken();

  if (!token) return next(req);

  return next(req.clone({
    setHeaders: { Authorization: `Bearer ${token}` }
  }));
};

// core/interceptors/error.interceptor.ts
// Trata erros HTTP globalmente — sem try/catch em todo serviço
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      switch (error.status) {
        case 401:
          router.navigate(['/login']);
          break;
        case 403:
          router.navigate(['/acesso-negado']);
          break;
        case 500:
          console.error('Server error', error);
          // notifica o usuário
          break;
      }
      return throwError(() => error);
    })
  );
};

// app.config.ts — registra interceptors
export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(
      withInterceptors([authInterceptor, errorInterceptor])
    ),
    provideRouter(routes, withPreloading(PreloadAllModules)),
  ]
};
```

---

## Signals — estado reativo moderno (Angular 17+)

```typescript
// features/orders/services/order.service.ts
import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Result, ok, err } from '../../core/models/result.model';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly _orders = signal<Order[]>([]);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);

  // Computed — derivado automaticamente, sem subscription manual
  readonly pendingOrders = computed(() =>
    this._orders().filter(o => o.status === 'pending')
  );

  readonly orders = this._orders.asReadonly();
  readonly loading = this._loading.asReadonly();

  constructor(private http: HttpClient) {}

  loadOrders(customerId: string): void {
    this._loading.set(true);
    this._error.set(null);

    this.http.get<Order[]>(`/api/orders?customerId=${customerId}`)
      .subscribe({
        next: (orders) => {
          this._orders.set(orders);
          this._loading.set(false);
        },
        error: (e) => {
          this._error.set(e.error?.message ?? 'LOAD_FAILED');
          this._loading.set(false);
        }
      });
  }

  cancelOrder(orderId: string): void {
    // Optimistic update
    this._orders.update(orders =>
      orders.map(o => o.id === orderId ? { ...o, status: 'cancelled' } : o)
    );

    this.http.delete(`/api/orders/${orderId}`).subscribe({
      error: () => this.loadOrders('') // reverte em erro
    });
  }
}

// features/orders/components/order-list/order-list.component.ts
@Component({
  selector: 'app-order-list',
  standalone: true,
  template: `
    @if (orderService.loading()) {
      <app-loading />
    } @else {
      @for (order of orderService.orders(); track order.id) {
        <div class="order-card">
          <span>{{ order.status }}</span>
          <button (click)="cancel(order.id)">Cancelar</button>
        </div>
      } @empty {
        <p>Nenhum pedido encontrado</p>
      }
    }
  `
})
export class OrderListComponent {
  orderService = inject(OrderService);

  cancel(id: string) {
    this.orderService.cancelOrder(id);
  }
}
```

---

## Lazy loading — não carregue o que não foi solicitado

```typescript
// app.routes.ts — carregamento sob demanda por feature
export const routes: Routes = [
  {
    path: 'orders',
    canActivate: [authGuard],
    loadChildren: () => import('./features/orders/orders.routes').then(m => m.ORDERS_ROUTES),
  },
  {
    path: 'catalog',
    // Sem guard — acesso público
    loadChildren: () => import('./features/catalog/catalog.routes').then(m => m.CATALOG_ROUTES),
  },
];

// Por que lazy loading?
// Bundle inicial menor → tempo de carregamento menor → usuário feliz
// Sem lazy: tudo carrega junto, mesmo que o usuário nunca vá na tela de admin
```

---

## Referência completa

- [czanix.com/pt/stack/backend](https://czanix.com/pt/stack/backend) — API que este frontend consome
- [czanix.com/pt/stack/tradeoffs](https://czanix.com/pt/stack/tradeoffs) — Angular vs React

---

<div align="center">
<sub>Desenvolvido e mantido por <a href="https://czanix.com">Cesar Zanis</a> — Czanix</sub>
</div>
