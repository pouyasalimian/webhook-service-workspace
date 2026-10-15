import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export class SwaggerConfig {
  static configure(app: INestApplication) {
    const options = new DocumentBuilder()
      .setTitle('Webhook Service Api Docs')
      .setVersion('v1.0')
      .build();

    const document = SwaggerModule.createDocument(app, options);

    SwaggerModule.setup('/swagger', app, document, {
      customSiteTitle: 'Webhook Service Api Docs',
      swaggerOptions: {
        docExpansion: 'none',
        layout: 'BaseLayout',
        tagsSorter: 'alpha',
      },
    });
  }
}
