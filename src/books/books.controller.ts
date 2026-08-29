import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Request,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { BookBackgroundService } from './book-background.service';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { GenerateBookBackgroundDto } from './dto/generate-book-background.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';
import { BufferedUploadFile, UploadsService } from '../uploads/uploads.service';

@ApiTags('Books')
@ApiBearerAuth('jwt-auth')
@Controller('books')
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly uploadsService: UploadsService,
    private readonly bookBackgroundService: BookBackgroundService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'coverImage', maxCount: 1 },
      { name: 'file', maxCount: 1 },
    ]),
  )
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string', example: 'English Basics' },
        description: { type: 'string', example: 'A beginner guide.' },
        content: { type: 'string', example: 'Book body content...' },
        isPublic: { type: 'boolean', example: false },
        coverImage: { type: 'string', format: 'binary' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  async createBook(
    @Request() req: AuthenticatedRequest,
    @Body() createBookDto: CreateBookDto,
    @UploadedFiles()
    files?: {
      coverImage?: BufferedUploadFile[];
      file?: BufferedUploadFile[];
    },
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }

    const coverImage = files?.coverImage?.[0];
    const bookFile = files?.file?.[0];
    const dto: CreateBookDto = { ...createBookDto };

    if (coverImage) {
      const upload = await this.uploadsService.uploadFile(
        req.user.id,
        coverImage,
        'book-covers',
        ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
      );
      dto.coverImage = upload.fileUrl;
    }

    if (bookFile) {
      if (bookFile.mimetype !== 'text/plain' && !dto.content) {
        throw new BadRequestException(
          'Provide content when uploading a non-text book file',
        );
      }

      const upload = await this.uploadsService.uploadFile(
        req.user.id,
        bookFile,
        'books',
        ['application/pdf', 'text/plain'],
      );
      dto.fileUrl = upload.fileUrl;

      if (bookFile.mimetype === 'text/plain') {
        dto.content = bookFile.buffer.toString('utf8');
      }
    }

    return this.booksService.createBook(req.user.id, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getBooks(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.booksService.getBooks(req.user.id);
  }

  @Get('public')
  async getPublicBooks(
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ) {
    return this.booksService.getPublicBooks(limit, offset);
  }

  @Get('review/due')
  @UseGuards(JwtAuthGuard)
  async getDueReviewCounts(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    const books = await this.booksService.getDueReviewCounts(req.user.id);

    return {
      books,
      totalDueForReview: books.reduce(
        (total, book) => total + book.dueForReview,
        0,
      ),
    };
  }

  @Post('backgrounds/generate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async generateBookBackgrounds(
    @Request() req: AuthenticatedRequest,
    @Body() dto: GenerateBookBackgroundDto,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }

    return this.bookBackgroundService.generateBackgrounds(req.user.id, dto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getBookById(
    @Request() req: AuthenticatedRequest,
    @Param('id') bookId: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.booksService.getBookById(bookId, req.user.id);
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  async updateBook(
    @Request() req: AuthenticatedRequest,
    @Param('id') bookId: string,
    @Body() updateBookDto: UpdateBookDto,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.booksService.updateBook(bookId, req.user.id, updateBookDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteBook(
    @Request() req: AuthenticatedRequest,
    @Param('id') bookId: string,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return this.booksService.deleteBook(bookId, req.user.id);
  }
}
