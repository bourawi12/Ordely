import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { JwtPayload } from '../auth/jwt-payload';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from './realtime.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.setServer(server);
  }

  async handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.headers?.authorization;
      const bearerToken = authHeader?.startsWith('Bearer ')
        ? authHeader.substring(7)
        : undefined;

      const queryToken =
        typeof client.handshake.query?.token === 'string'
          ? client.handshake.query.token
          : undefined;

      const token = client.handshake.auth?.token || bearerToken || queryToken;

      if (!token) {
        client.disconnect(true);
        return;
      }

      const payload = await this.jwtService.verifyAsync<JwtPayload>(token);

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          boutiqueId: true,
          passwordChangedAt: true,
        },
      });

      if (
        !user ||
        (user.passwordChangedAt &&
          (payload.iat ?? 0) * 1000 < user.passwordChangedAt.getTime())
      ) {
        client.disconnect(true);
        return;
      }

      client.data.user = {
        sub: user.id,
        email: user.email,
        boutiqueId: user.boutiqueId,
      };

      const roomName = `boutique:${user.boutiqueId}`;
      await client.join(roomName);
    } catch {
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) {
    // Connection cleaned up automatically by Socket.IO
  }
}
