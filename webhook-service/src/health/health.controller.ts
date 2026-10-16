import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { HealthService } from './health.service.js';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('check')
  @ApiOperation({ summary: 'Check that the application is responding' })
  @ApiOkResponse({ schema: { type: 'boolean', example: true } })
  check() {
    return true;
  }

  @Get('status')
  @ApiOperation({ summary: 'Check application and dependency status' })
  @ApiOkResponse({
    description: 'The application and dependencies are healthy.',
  })
  @ApiResponse({
    status: HttpStatus.SERVICE_UNAVAILABLE,
    description: 'The application is running but a dependency is unavailable.',
  })
  async status(@Res({ passthrough: true }) response: Response) {
    const status = await this.health.status();
    response.status(
      status.status === 'ok' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );
    return status;
  }
}
