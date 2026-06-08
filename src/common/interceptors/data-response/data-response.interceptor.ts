import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { map, Observable } from 'rxjs'

/**
 * Global Interceptor to transform all outgoing API responses.
 * we are adding an 'apiVersion' property to the response object
 * and nesting the original response inside the 'data' property
 * * @example
 * Before Interceptor (What the Controller returns):
 * {
 * "id": 16,
 * "firstName": "Izuku",
 * "lastName": "Midoriya"
 * }
 * After Interceptor (What the Client actually receives):
 * {
 * "apiVersion": "0.1.1",
 * "data": {
 * "id": 16,
 * "firstName": "Izuku",
 * "lastName": "Midoriya"
 * }
 * }
 */
@Injectable()
export class DataResponseInterceptor implements NestInterceptor {
  constructor(
    /**
     * Inject ConfigService to access global application configuration variables     */
    private readonly configService: ConfigService,
  ) {}
  /**
   * Intercepts incoming requests and transforms outgoing responses.
   * * @param context - ExecutionContext providing details about the current request lifecycle
   * @param next - CallHandler to invoke the next handler/controller in the pipeline
   * @returns An Observable that emits the standardized response object
   */
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // next.handle() executes the route handler (controller method) and gets its return value
    return next.handle().pipe(
      /**
       * Use RxJS map operator to intercept and mutate the response payload
       * @param data - The original data returned from the controller (e.g., User object)
       */
      map((data: unknown) => ({
        // Dynamically fetch the API version from the configuration service (env variable)
        apiVersion: this.configService.get<string>('appConfig.apiVersion'),
        // Nest the original controller response inside the 'data' property
        data: data,
      })),
    )
  }
}
