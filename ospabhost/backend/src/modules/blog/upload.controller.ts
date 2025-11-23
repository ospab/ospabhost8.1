// backend/src/modules/blog/upload.controller.ts
import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';

export const uploadImage = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Файл не загружен'
      });
    }

    // Генерируем URL для доступа к изображению
    const imageUrl = `/uploads/blog/${req.file.filename}`;

    return res.status(200).json({
      success: true,
      data: {
        url: `https://ospab.host:5000${imageUrl}`,
        filename: req.file.filename
      }
    });
  } catch (error) {
    console.error('Ошибка загрузки изображения:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка загрузки изображения'
    });
  }
};

export const deleteImage = async (req: Request, res: Response) => {
  try {
    const { filename } = req.params;
    
    if (!filename) {
      return res.status(400).json({
        success: false,
        message: 'Имя файла не указано'
      });
    }

    const filePath = path.join(__dirname, '../../../uploads/blog', filename);
    
    // Проверяем существование файла
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return res.status(200).json({
        success: true,
        message: 'Изображение удалено'
      });
    } else {
      return res.status(404).json({
        success: false,
        message: 'Файл не найден'
      });
    }
  } catch (error) {
    console.error('Ошибка удаления изображения:', error);
    return res.status(500).json({
      success: false,
      message: 'Ошибка удаления изображения'
    });
  }
};
