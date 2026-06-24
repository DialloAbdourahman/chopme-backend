import { Global, Module } from '@nestjs/common';
import { WebSocketService } from './web-socket-service';

@Global()
@Module({
  providers: [WebSocketService],
})
export class WebSocketModule {}
