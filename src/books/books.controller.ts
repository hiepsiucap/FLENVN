import {
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
  UseGuards,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { CreateBookDto } from './dto/create-book.dto';
import { UpdateBookDto } from './dto/update-book.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/interfaces/authenticated-request.interface';

@Controller('books')
export class BooksController {
  constructor(private readonly booksService: BooksService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createBook(
    @Request() req: AuthenticatedRequest,
    @Body() createBookDto: CreateBookDto,
  ) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.booksService.createBook(req.user.id, createBookDto),
    };
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getBooks(@Request() req: AuthenticatedRequest) {
    if (!req.user?.id) {
      throw new Error('User not authenticated');
    }
    return {
      success: true,
      data: await this.booksService.getBooks(req.user.id),
    };
  }

  @Get('public')
  async getPublicBooks(
    @Query('limit') limit: number = 10,
    @Query('offset') offset: number = 0,
  ) {
    return {
      success: true,
      data: await this.booksService.getPublicBooks(limit, offset),
    };
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
    return {
      success: true,
      data: await this.booksService.getBookById(bookId, req.user.id),
    };
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
    return {
      success: true,
      data: await this.booksService.updateBook(
        bookId,
        req.user.id,
        updateBookDto,
      ),
    };
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
    return {
      success: true,
      data: await this.booksService.deleteBook(bookId, req.user.id),
    };
  }
}
